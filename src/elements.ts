import { registerStableCallback, registerCallback } from './chat';
import type { ClickEvent } from './types';

// Elementos Multimedia
export class ImageElement {
	constructor(
		public readonly source: string | Buffer,
		public readonly options?: { caption?: string }
	) {}
}

export class VideoElement {
	constructor(
		public readonly source: string | Buffer,
		public readonly options?: { caption?: string }
	) {}
}

export class AudioElement {
	constructor(
		public readonly source: string | Buffer,
		public readonly options?: { ptt?: boolean }
	) {}
}

export class DocumentElement {
	constructor(
		public readonly source: string | Buffer,
		public readonly options?: { filename?: string; mimeType?: string }
	) {}
}

export class LocationElement {
	constructor(
		public readonly latitude: number,
		public readonly longitude: number,
		public readonly options?: { name?: string; address?: string }
	) {}
}

export class StickerElement {
	constructor(public readonly source: string | Buffer) {}
}

// Encuestas Nativas de WhatsApp
export class PollElement {
	constructor(
		public readonly name: string,
		public readonly options: string[],
		public readonly selectableCount: number = 1
	) {}
}

// Componentes Interactivos
export class ButtonElement {
	public readonly clickId: string;
	public readonly label: string;
	public readonly isStable: boolean;

	constructor(options: { id?: string; label: string; onClick: (event: ClickEvent) => void | Promise<void> }) {
		this.label = options.label;
		if (options.id) {
			this.clickId = options.id;
			this.isStable = true;
			// Registrar callback de forma estable (tolerante a reinicios)
			registerStableCallback(options.id, 0, options.onClick);
		} else {
			this.isStable = false;
			// Generar ID efímero registrado en memoria (WeakRef)
			const efemId = registerCallback(options.onClick);
			this.clickId = efemId;
		}
	}
}

export class LinkButtonElement {
	public readonly label: string;
	public readonly url: string;

	constructor(options: { label: string; url: string }) {
		this.label = options.label;
		this.url = options.url;
	}
}

export class RichMessageElement {
	constructor(
		public readonly text: string,
		public readonly options?: {
			footer?: string;
			header?: string;
			headerImage?: string | Buffer;
			headerVideo?: string | Buffer;
			headerDocument?: string | Buffer;
			headerDocumentMimetype?: string;
			components?: (ButtonElement | LinkButtonElement | ListElement)[];
		}
	) {}
}

// Menú Desplegable interactivo
export interface ListRowOption {
	title: string;
	description?: string;
	onClick: (event: ClickEvent) => void | Promise<void>;
}

export interface ListSectionOption {
	title: string;
	rows: ListRowOption[];
}

export class ListElement {
	public readonly id: string;
	public readonly config: { title: string; text: string; buttonText: string; sections: ListSectionOption[]; footer?: string };

	constructor(
		idOrConfig: string | { title: string; text: string; buttonText: string; sections: ListSectionOption[]; footer?: string },
		config?: { title: string; text: string; buttonText: string; sections: ListSectionOption[]; footer?: string }
	) {
		const isStable = typeof idOrConfig === 'string';
		const actualConfig = isStable ? config! : idOrConfig as any;
		this.id = isStable ? idOrConfig : `list_h_${Math.random().toString(36).substring(2, 9)}`;
		this.config = actualConfig;

		// Registrar los callbacks de cada fila de forma persistente
		this.config.sections.forEach((section, secIndex) => {
			section.rows.forEach((row, rowIndex) => {
				const rowKey = `${this.id}:${secIndex}:${rowIndex}`;
				registerStableCallback(rowKey, 0, row.onClick);
			});
		});
	}
}

// Constructores funcionales y JSX (Soporte Dual Sobrecargado)

export function Image(source: string | Buffer, options?: { caption?: string }): ImageElement;
export function Image(props: { url?: string; source?: string | Buffer; caption?: string; children?: any }): JSX.Element;
export function Image(sourceOrProps: any, options?: { caption?: string }): any {
	if (sourceOrProps && typeof sourceOrProps === 'object' && !Buffer.isBuffer(sourceOrProps) && ('url' in sourceOrProps || 'source' in sourceOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Image', props: sourceOrProps };
	}
	return new ImageElement(sourceOrProps, options);
}

export function Video(source: string | Buffer, options?: { caption?: string }): VideoElement;
export function Video(props: { url?: string; source?: string | Buffer; caption?: string; children?: any }): JSX.Element;
export function Video(sourceOrProps: any, options?: { caption?: string }): any {
	if (sourceOrProps && typeof sourceOrProps === 'object' && !Buffer.isBuffer(sourceOrProps) && ('url' in sourceOrProps || 'source' in sourceOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Video', props: sourceOrProps };
	}
	return new VideoElement(sourceOrProps, options);
}

export function Audio(source: string | Buffer, options?: { ptt?: boolean }): AudioElement;
export function Audio(props: { url?: string; source?: string | Buffer; ptt?: boolean; children?: any }): JSX.Element;
export function Audio(sourceOrProps: any, options?: { ptt?: boolean }): any {
	if (sourceOrProps && typeof sourceOrProps === 'object' && !Buffer.isBuffer(sourceOrProps) && ('url' in sourceOrProps || 'source' in sourceOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Audio', props: sourceOrProps };
	}
	return new AudioElement(sourceOrProps, options);
}

export function Document(source: string | Buffer, options?: { filename?: string; mimeType?: string }): DocumentElement;
export function Document(props: { url?: string; source?: string | Buffer; filename?: string; mimeType?: string; children?: any }): JSX.Element;
export function Document(sourceOrProps: any, options?: { filename?: string; mimeType?: string }): any {
	if (sourceOrProps && typeof sourceOrProps === 'object' && !Buffer.isBuffer(sourceOrProps) && ('url' in sourceOrProps || 'source' in sourceOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Document', props: sourceOrProps };
	}
	return new DocumentElement(sourceOrProps, options);
}

export function Location(latitude: number, longitude: number, options?: { name?: string; address?: string }): LocationElement;
export function Location(props: { latitude: number; longitude: number; name?: string; address?: string; children?: any }): JSX.Element;
export function Location(latitudeOrProps: any, longitude?: number, options?: { name?: string; address?: string }): any {
	if (latitudeOrProps && typeof latitudeOrProps === 'object' && ('latitude' in latitudeOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Location', props: latitudeOrProps };
	}
	return new LocationElement(latitudeOrProps, longitude!, options);
}

export function Sticker(source: string | Buffer): StickerElement;
export function Sticker(props: { url?: string; source?: string | Buffer; children?: any }): JSX.Element;
export function Sticker(sourceOrProps: any): any {
	if (sourceOrProps && typeof sourceOrProps === 'object' && !Buffer.isBuffer(sourceOrProps) && ('url' in sourceOrProps || 'source' in sourceOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Sticker', props: sourceOrProps };
	}
	return new StickerElement(sourceOrProps);
}

export function Button(options: { id?: string; label: string; onClick: (event: ClickEvent) => void | Promise<void> }): ButtonElement;
export function Button(props: { id?: string; onClick?: (event: ClickEvent) => void | Promise<void>; children?: any }): JSX.Element;
export function Button(optionsOrProps: any): any {
	if (optionsOrProps && 'label' in optionsOrProps && !('children' in optionsOrProps)) {
		return new ButtonElement(optionsOrProps);
	}
	return { $$typeof: Symbol.for('conversa.jsx'), type: 'Button', props: optionsOrProps };
}

export function LinkButton(options: { label: string; url: string }): LinkButtonElement;
export function LinkButton(props: { url: string; children?: any }): JSX.Element;
export function LinkButton(optionsOrProps: any): any {
	if (optionsOrProps && 'label' in optionsOrProps && !('children' in optionsOrProps)) {
		return new LinkButtonElement(optionsOrProps);
	}
	return { $$typeof: Symbol.for('conversa.jsx'), type: 'LinkButton', props: optionsOrProps };
}

export function RichMessage(text: string, options?: { footer?: string; header?: string; headerImage?: string | Buffer; headerVideo?: string | Buffer; headerDocument?: string | Buffer; headerDocumentMimetype?: string; components?: (ButtonElement | LinkButtonElement | ListElement)[] }): RichMessageElement;
export function RichMessage(props: { text?: string; footer?: string; header?: string; children?: any }): JSX.Element;
export function RichMessage(textOrProps: any, options?: any): any {
	if (textOrProps && typeof textOrProps === 'object' && ('text' in textOrProps || 'children' in textOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'RichMessage', props: textOrProps };
	}
	return new RichMessageElement(textOrProps, options);
}

export function List(id: string, config: { title: string; text: string; buttonText: string; sections: ListSectionOption[]; footer?: string }): ListElement;
export function List(props: { id?: string; title: string; text: string; buttonText: string; footer?: string; children?: any }): JSX.Element;
export function List(idOrConfig: any, config?: any): any {
	if (typeof idOrConfig === 'string' || (idOrConfig && 'sections' in idOrConfig)) {
		return new ListElement(idOrConfig, config);
	}
	return { $$typeof: Symbol.for('conversa.jsx'), type: 'List', props: idOrConfig };
}

export function Poll(name: string, options: string[], selectableCount?: number): PollElement;
export function Poll(props: { name?: string; question?: string; selectableCount?: number; children?: any }): JSX.Element;
export function Poll(nameOrProps: any, options?: string[], selectableCount?: number): any {
	if (nameOrProps && typeof nameOrProps === 'object' && !Array.isArray(nameOrProps) && ('name' in nameOrProps || 'question' in nameOrProps)) {
		return { $$typeof: Symbol.for('conversa.jsx'), type: 'Poll', props: nameOrProps };
	}
	const name = typeof nameOrProps === 'string' ? nameOrProps : '';
	return new PollElement(name, options || [], selectableCount || 1);
}

// Componentes exclusivos de JSX
export function Section(props: { title: string; children?: any }): JSX.Element {
	return { $$typeof: Symbol.for('conversa.jsx'), type: 'Section', props } as any;
}

export function Row(props: { title: string; description?: string; onClick: (event: ClickEvent) => void | Promise<void>; children?: any }): JSX.Element {
	return { $$typeof: Symbol.for('conversa.jsx'), type: 'Row', props } as any;
}

export function Option(props: { value?: string; children?: any }): JSX.Element {
	return { $$typeof: Symbol.for('conversa.jsx'), type: 'Option', props } as any;
}
