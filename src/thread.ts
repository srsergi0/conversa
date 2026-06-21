import { WASocket, prepareWAMessageMedia } from 'baileys';
import type { PostableMessage, PostableButtons } from './types';
import { registerCallback } from './chat';
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
import { compileJSX } from './jsx-compiler';
import { JSX_SYMBOL } from './jsx-runtime';

export class Thread {
	constructor(
		public readonly id: string, // Formato: `sessionId:jid`
		public readonly sessionId: string,
		public readonly jid: string,
		private readonly socket: WASocket
	) {}

	/**
	 * Envía un mensaje al hilo
	 */
	async post(content: PostableMessage) {
		if (content && typeof content === 'object' && '$$typeof' in content && (content as any).$$typeof === JSX_SYMBOL) {
			content = compileJSX(content);
		}

		if (typeof content === 'string') {
			return this.socket.sendMessage(this.jid, { text: content });
		}

		// 1. Manejar Elementos Multimedia y Ubicación Declarativos
		if (content instanceof ImageElement) {
			const source = content.source;
			const payload: any = {};
			if (typeof source === 'string') {
				payload.image = { url: source };
			} else {
				payload.image = source;
			}
			if (content.options?.caption) {
				payload.caption = content.options.caption;
			}
			return this.socket.sendMessage(this.jid, payload as any);
		}

		if (content instanceof VideoElement) {
			const source = content.source;
			const payload: any = {};
			if (typeof source === 'string') {
				payload.video = { url: source };
			} else {
				payload.video = source;
			}
			if (content.options?.caption) {
				payload.caption = content.options.caption;
			}
			return this.socket.sendMessage(this.jid, payload as any);
		}

		if (content instanceof AudioElement) {
			const source = content.source;
			const payload: any = {};
			if (typeof source === 'string') {
				payload.audio = { url: source };
			} else {
				payload.audio = source;
			}
			if (content.options?.ptt) {
				payload.ptt = true;
			}
			return this.socket.sendMessage(this.jid, payload as any);
		}

		if (content instanceof DocumentElement) {
			const source = content.source;
			const payload: any = {};
			if (typeof source === 'string') {
				payload.document = { url: source };
			} else {
				payload.document = source;
			}
			if (content.options?.filename) {
				payload.fileName = content.options.filename;
			}
			if (content.options?.mimeType) {
				payload.mimetype = content.options.mimeType;
			}
			return this.socket.sendMessage(this.jid, payload as any);
		}

		if (content instanceof LocationElement) {
			return this.socket.sendMessage(this.jid, {
				location: {
					degreesLatitude: content.latitude,
					degreesLongitude: content.longitude,
					name: content.options?.name,
					address: content.options?.address
				}
			} as any);
		}

		if (content instanceof StickerElement) {
			const source = content.source;
			const payload: any = {};
			if (typeof source === 'string') {
				payload.sticker = { url: source };
			} else {
				payload.sticker = source;
			}
			return this.socket.sendMessage(this.jid, payload as any);
		}

		// Manejar Encuestas Nativas de WhatsApp
		if (content instanceof PollElement) {
			return this.socket.sendMessage(this.jid, {
				poll: {
					name: content.name,
					values: content.options,
					selectableCount: content.selectableCount
				}
			});
		}

		// 2. Manejar Clase List (Menú Desplegable)
		if (content instanceof ListElement) {
			const config = content.config;
			const formattedSections = config.sections.map((section, secIndex) => {
				return {
					title: section.title,
					rows: section.rows.map((row, rowIndex) => {
						const rowKey = JSON.stringify({
							stableId: content.id,
							sec: secIndex,
							row: rowIndex
						});
						return {
							title: row.title,
							description: row.description,
							id: rowKey
						};
					})
				};
			});

			const payload = {
				viewOnceMessage: {
					message: {
						interactiveMessage: {
							header: {
								title: config.title,
								hasMediaAttachment: false
							},
							body: {
								text: config.text
							},
							footer: config.footer ? {
								text: config.footer
							} : undefined,
							nativeFlowMessage: {
								buttons: [
									{
										name: 'single_select',
										buttonParamsJson: JSON.stringify({
											title: config.buttonText,
											sections: formattedSections
										})
									}
								]
							}
						}
					}
				}
			};

			return this.socket.sendMessage(this.jid, payload as any);
		}

		// 3. Manejar Componente RichMessage (Árbol de Componentes de Mensajes Interactivos)
		if (content instanceof RichMessageElement) {
			const text = content.text;
			const footer = content.options?.footer;
			const header = content.options?.header;
			const components = content.options?.components || [];

			if (components.length > 0) {
				const formattedButtons = components.map(comp => {
					if (comp instanceof ButtonElement) {
						const buttonIdJson = JSON.stringify(
							comp.isStable 
								? { stableId: comp.clickId, index: 0 }
								: { click: comp.clickId }
						);
						return {
							name: 'quick_reply',
							buttonParamsJson: JSON.stringify({
								display_text: comp.label,
								id: buttonIdJson
							})
						};
					} else if (comp instanceof LinkButtonElement) {
						// LinkButtonElement
						return {
							name: 'cta_url',
							buttonParamsJson: JSON.stringify({
								display_text: comp.label,
								url: comp.url,
								merchant_url: comp.url
							})
						};
					} else {
						// ListElement
						const config = comp.config;
						const formattedSections = config.sections.map((section, secIndex) => {
							return {
								title: section.title,
								rows: section.rows.map((row, rowIndex) => {
									const rowKey = JSON.stringify({
										stableId: comp.id,
										sec: secIndex,
										row: rowIndex
									});
									return {
										title: row.title,
										description: row.description,
										id: rowKey
									};
								})
							};
						});
						return {
							name: 'single_select',
							buttonParamsJson: JSON.stringify({
								title: config.buttonText,
								sections: formattedSections
							})
						};
					}
				});

				let headerPayload: any = undefined;
				if (content.options?.headerImage) {
					try {
						const media = await prepareWAMessageMedia(
							typeof content.options.headerImage === 'string' 
								? { image: { url: content.options.headerImage } } 
								: { image: content.options.headerImage },
							{ upload: this.socket.waUploadToServer }
						);
						headerPayload = {
							hasMediaAttachment: true,
							imageMessage: media.imageMessage
						};
					} catch (err) {
						console.error('[Conversa SDK] Error al preparar media header image:', err);
						if (header) {
							headerPayload = { title: header, hasMediaAttachment: false };
						}
					}
				} else if (content.options?.headerVideo) {
					try {
						const media = await prepareWAMessageMedia(
							typeof content.options.headerVideo === 'string' 
								? { video: { url: content.options.headerVideo } } 
								: { video: content.options.headerVideo },
							{ upload: this.socket.waUploadToServer }
						);
						headerPayload = {
							hasMediaAttachment: true,
							videoMessage: media.videoMessage
						};
					} catch (err) {
						console.error('[Conversa SDK] Error al preparar media header video:', err);
						if (header) {
							headerPayload = { title: header, hasMediaAttachment: false };
						}
					}
				} else if (content.options?.headerDocument) {
					try {
						const media = await prepareWAMessageMedia(
							{
								document: typeof content.options.headerDocument === 'string' 
									? { url: content.options.headerDocument } 
									: content.options.headerDocument,
								mimetype: content.options.headerDocumentMimetype || 'application/octet-stream'
							} as any,
							{ upload: this.socket.waUploadToServer }
						);
						headerPayload = {
							hasMediaAttachment: true,
							documentMessage: media.documentMessage
						};
					} catch (err) {
						console.error('[Conversa SDK] Error al preparar media header document:', err);
						if (header) {
							headerPayload = { title: header, hasMediaAttachment: false };
						}
					}
				} else if (header) {
					headerPayload = {
						title: header,
						hasMediaAttachment: false
					};
				}

				const payload = {
					viewOnceMessage: {
						message: {
							interactiveMessage: {
								header: headerPayload,
								body: {
									text: text
								},
								footer: footer ? {
									text: footer
								} : undefined,
								nativeFlowMessage: {
									buttons: formattedButtons
								}
							}
						}
					}
				};

				return this.socket.sendMessage(this.jid, payload as any);
			}

			// Si no hay botones pero hay elementos multimedia en las opciones
			if (content.options?.headerImage) {
				const source = content.options.headerImage;
				return this.socket.sendMessage(this.jid, {
					image: typeof source === 'string' ? { url: source } : source,
					caption: text
				} as any);
			}
			if (content.options?.headerVideo) {
				const source = content.options.headerVideo;
				return this.socket.sendMessage(this.jid, {
					video: typeof source === 'string' ? { url: source } : source,
					caption: text
				} as any);
			}
			if (content.options?.headerDocument) {
				const source = content.options.headerDocument;
				return this.socket.sendMessage(this.jid, {
					document: typeof source === 'string' ? { url: source } : source,
					caption: text
				} as any);
			}

			return this.socket.sendMessage(this.jid, { text } as any);
		}

		// 4. Fallback de Mensaje con Botones Plano (Legacy)
		if (typeof content === 'object' && 'buttons' in content) {
			const buttonsContent = content as PostableButtons;
			const text = buttonsContent.text;
			const footer = buttonsContent.footer;
			const header = buttonsContent.header;
			
			const formattedButtons = buttonsContent.buttons.map(btn => {
				const callbackId = registerCallback(btn.onClick);
				const buttonIdJson = JSON.stringify({
					click: callbackId
				});
				return {
					name: 'quick_reply',
					buttonParamsJson: JSON.stringify({
						display_text: btn.label,
						id: buttonIdJson
					})
				};
			});

			const payload = {
				viewOnceMessage: {
					message: {
						interactiveMessage: {
							header: header ? {
								title: header,
								hasMediaAttachment: false
							} : undefined,
							body: {
								text: text
							},
							footer: footer ? {
								text: footer
							} : undefined,
							nativeFlowMessage: {
								buttons: formattedButtons
							}
						}
					}
				}
			};

			return this.socket.sendMessage(this.jid, payload as any);
		}

		// 5. Fallback de Mensajes de Texto y Multimedia ordinarios
		const anyContent = content as any;
		const textContent = anyContent.text || anyContent.raw || anyContent.markdown || '';

		if (anyContent.files && anyContent.files.length > 0) {
			const file = anyContent.files[0];
			let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
			const mime = file.mimeType || '';
			
			if (mime.startsWith('image/')) {
				mediaType = 'image';
			} else if (mime.startsWith('video/')) {
				mediaType = 'video';
			} else if (mime.startsWith('audio/')) {
				mediaType = 'audio';
			}

			const payload: any = {};
			
			let dataBuffer: Buffer;
			if (file.data instanceof Buffer) {
				dataBuffer = file.data;
			} else if (file.data instanceof ArrayBuffer) {
				dataBuffer = Buffer.from(file.data);
			} else {
				// Blob
				dataBuffer = Buffer.from(await (file.data as Blob).arrayBuffer());
			}

			payload[mediaType] = dataBuffer;
			
			if (textContent) {
				payload.caption = textContent;
			}
			
			if (mediaType === 'document') {
				payload.fileName = file.filename;
				payload.mimetype = mime;
			}

			return this.socket.sendMessage(this.jid, payload as any);
		}

		return this.socket.sendMessage(this.jid, { text: textContent } as any);
	}

	/**
	 * Reacciona a un mensaje específico
	 */
	async react(emoji: string, messageId: string) {
		return this.socket.sendMessage(this.jid, {
			react: {
				text: emoji,
				key: {
					remoteJid: this.jid,
					id: messageId,
					fromMe: false,
				}
			}
		});
	}

	/**
	 * Envía multimedia directamente por URL
	 */
	async postMedia(url: string, type: 'image' | 'video' | 'audio' | 'document', options?: { caption?: string; fileName?: string }) {
		const payload: any = {};
		payload[type] = { url };
		
		if (options?.caption) {
			payload.caption = options.caption;
		}
		
		if (type === 'document' && options?.fileName) {
			payload.fileName = options.fileName;
		}

		return this.socket.sendMessage(this.jid, payload as any);
	}
}
