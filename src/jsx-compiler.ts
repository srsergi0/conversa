import { JSX_SYMBOL, JSXNode } from './jsx-runtime';
import {
	ImageElement,
	VideoElement,
	AudioElement,
	DocumentElement,
	LocationElement,
	StickerElement,
	ButtonElement,
	LinkButtonElement,
	RichMessageElement,
	ListElement,
	PollElement
} from './elements';
import type { PostableMessage } from './types';

function flattenChildren(children: any): any[] {
	if (children === null || children === undefined || children === false || children === true) {
		return [];
	}
	if (Array.isArray(children)) {
		return children.flatMap(flattenChildren);
	}
	return [children];
}

export function compileJSX(node: any): PostableMessage {
	if (!node) return '';

	if (typeof node === 'string' || typeof node === 'number') {
		return String(node);
	}

	// Si no es un nodo JSX, lo retornamos tal cual (por si ya es un elemento Conversa)
	if (node.$$typeof !== JSX_SYMBOL) {
		return node;
	}

	const { type, props } = node as JSXNode;
	const cProps = props || {};
	const children = flattenChildren(cProps.children);

	switch (type) {
		case 'RichMessage': {
			const header = cProps.header;
			const footer = cProps.footer;

			let bodyText = cProps.text || '';
			let headerImage: any = undefined;
			let headerVideo: any = undefined;
			let headerDocument: any = undefined;
			let headerDocumentMimetype: string | undefined = undefined;
			
			// Objetos de ubicación y sticker independientes si no hay botones
			let locationData: any = undefined;
			let stickerData: any = undefined;
			let audioData: any = undefined;

			const components: any[] = [];

			const processNodes = (nodes: any[]) => {
				for (const child of nodes) {
					if (child === null || child === undefined || child === false || child === true) {
						continue;
					}
					if (typeof child === 'string' || typeof child === 'number') {
						bodyText += (bodyText ? '\n' : '') + child;
						continue;
					}
					if (child.$$typeof === JSX_SYMBOL) {
						const childType = child.type;
						const childProps = child.props || {};
						const childChildren = flattenChildren(childProps.children);

						switch (childType) {
							case 'Image':
								headerImage = childProps.url || childProps.source;
								if (childProps.caption) {
									bodyText += (bodyText ? '\n' : '') + childProps.caption;
								}
								break;
							case 'Video':
								headerVideo = childProps.url || childProps.source;
								if (childProps.caption) {
									bodyText += (bodyText ? '\n' : '') + childProps.caption;
								}
								break;
							case 'Audio':
								audioData = {
									source: childProps.url || childProps.source,
									ptt: childProps.ptt
								};
								break;
							case 'Document':
								headerDocument = childProps.url || childProps.source;
								headerDocumentMimetype = childProps.mimeType;
								break;
							case 'Location':
								locationData = {
									latitude: childProps.latitude,
									longitude: childProps.longitude,
									name: childProps.name,
									address: childProps.address
								};
								break;
							case 'Sticker':
								stickerData = childProps.url || childProps.source;
								break;
							case 'Button': {
								const label = childProps.label || childChildren.join(' ') || '';
								const id = childProps.id;
								const onClick = childProps.onClick;
								components.push(new ButtonElement({ id, label, onClick }));
								break;
							}
							case 'LinkButton': {
								const label = childProps.label || childChildren.join(' ') || '';
								const url = childProps.url || '';
								components.push(new LinkButtonElement({ label, url }));
								break;
							}
							case 'List': {
								const listId = childProps.id || `list_${Math.random().toString(36).substring(2, 9)}`;
								const listTitle = childProps.title || 'List';
								const listText = childProps.text || 'Choose option';
								const listButtonText = childProps.buttonText || 'Open Menu';
								const listFooter = childProps.footer;
								const listSections = compileListSections(childChildren, childProps);
								
								components.push(new ListElement(listId, {
									title: listTitle,
									text: listText,
									buttonText: listButtonText,
									footer: listFooter,
									sections: listSections
								}));
								break;
							}
							default:
								// Si es otro elemento anidado, procesar sus hijos
								if (childProps.children) {
									processNodes(flattenChildren(childProps.children));
								}
								break;
						}
					}
				}
			};

			processNodes(children);

			// Si hay botones interactivos o menú de lista, enviamos un RichMessageElement
			if (components.length > 0) {
				return new RichMessageElement(bodyText, {
					header,
					footer,
					headerImage,
					headerVideo,
					headerDocument,
					headerDocumentMimetype,
					components
				});
			}

			// Si no hay botones pero hay elementos multimedia independientes
			if (headerImage) {
				return new ImageElement(headerImage, { caption: bodyText });
			}
			if (headerVideo) {
				return new VideoElement(headerVideo, { caption: bodyText });
			}
			if (audioData) {
				return new AudioElement(audioData.source, { ptt: audioData.ptt });
			}
			if (headerDocument) {
				return new DocumentElement(headerDocument, { filename: cProps.filename, mimeType: headerDocumentMimetype });
			}
			if (locationData) {
				return new LocationElement(locationData.latitude, locationData.longitude, {
					name: locationData.name,
					address: locationData.address
				});
			}
			if (stickerData) {
				return new StickerElement(stickerData);
			}

			return bodyText;
		}

		case 'Image':
			return new ImageElement(cProps.url || cProps.source, { caption: cProps.caption });

		case 'Video':
			return new VideoElement(cProps.url || cProps.source, { caption: cProps.caption });

		case 'Audio':
			return new AudioElement(cProps.url || cProps.source, { ptt: cProps.ptt });

		case 'Document':
			return new DocumentElement(cProps.url || cProps.source, { filename: cProps.filename, mimeType: cProps.mimeType || cProps.mimetype });

		case 'Location':
			return new LocationElement(cProps.latitude, cProps.longitude, { name: cProps.name, address: cProps.address });

		case 'Sticker':
			return new StickerElement(cProps.url || cProps.source);

		case 'List': {
			const listId = cProps.id || `list_${Math.random().toString(36).substring(2, 9)}`;
			const listTitle = cProps.title || 'List';
			const listText = cProps.text || 'Choose option';
			const listButtonText = cProps.buttonText || 'Open Menu';
			const listFooter = cProps.footer;
			const listSections = compileListSections(children, cProps);

			return new ListElement(listId, {
				title: listTitle,
				text: listText,
				buttonText: listButtonText,
				footer: listFooter,
				sections: listSections
			});
		}

		case 'Poll': {
			const question = cProps.name || cProps.question || 'Choose option';
			const selectableCount = typeof cProps.selectableCount === 'number' ? cProps.selectableCount : 1;
			
			const options: string[] = [];
			children.forEach(child => {
				if (child && child.$$typeof === JSX_SYMBOL && child.type === 'Option') {
					const optProps = child.props || {};
					const optVal = optProps.value || flattenChildren(optProps.children).join(' ');
					if (optVal) {
						options.push(optVal);
					}
				}
			});

			return new PollElement(question, options, selectableCount);
		}

		default:
			// Si el tag es desconocido o es un fragmento, compilar sus hijos
			if (cProps.children) {
				const compiledChildren = children.map(compileJSX);
				if (compiledChildren.length === 1) {
					return compiledChildren[0];
				}
				return compiledChildren[0];
			}
			return '';
	}
}

function compileListSections(children: any[], parentProps: any): any[] {
	const sections: any[] = [];

	children.forEach(child => {
		if (!child || child.$$typeof !== JSX_SYMBOL) return;

		if (child.type === 'Section') {
			const secProps = child.props || {};
			const secTitle = secProps.title || 'Section';
			const rowChildren = flattenChildren(secProps.children);
			const rows = compileListRows(rowChildren, parentProps);
			sections.push({ title: secTitle, rows });
		} else if (child.type === 'Row') {
			let defaultSec = sections.find(s => s.title === 'Options');
			if (!defaultSec) {
				defaultSec = { title: 'Options', rows: [] };
				sections.push(defaultSec);
			}
			const rowProps = child.props || {};
			const rowChildren = flattenChildren(rowProps.children);
			const rowTitle = rowProps.title || rowChildren.join(' ') || '';
			const rowDesc = rowProps.description;
			const rowClick = rowProps.onClick;

			defaultSec.rows.push({
				title: rowTitle,
				description: rowDesc,
				onClick: async (event: any) => {
					if (rowClick) {
						await rowClick(event);
					}
				}
			});
		}
	});

	return sections;
}

function compileListRows(children: any[], parentProps: any): any[] {
	const rows: any[] = [];
	children.forEach(child => {
		if (!child || child.$$typeof !== JSX_SYMBOL || child.type !== 'Row') return;

		const rowProps = child.props || {};
		const rowChildren = flattenChildren(rowProps.children);
		const rowTitle = rowProps.title || rowChildren.join(' ') || '';
		const rowDesc = rowProps.description;
		const rowClick = rowProps.onClick;

		rows.push({
			title: rowTitle,
			description: rowDesc,
			onClick: async (event: any) => {
				if (rowClick) {
					await rowClick(event);
				}
			}
		});
	});
	return rows;
}
