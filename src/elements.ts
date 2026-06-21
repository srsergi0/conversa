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

// Constructores funcionales multimedia
export const Image = (source: string | Buffer, options?: { caption?: string }) => new ImageElement(source, options);
export const Video = (source: string | Buffer, options?: { caption?: string }) => new VideoElement(source, options);
export const Audio = (source: string | Buffer, options?: { ptt?: boolean }) => new AudioElement(source, options);
export const Document = (source: string | Buffer, options?: { filename?: string; mimeType?: string }) => new DocumentElement(source, options);
export const Location = (latitude: number, longitude: number, options?: { name?: string; address?: string }) => new LocationElement(latitude, longitude, options);
export const Sticker = (source: string | Buffer) => new StickerElement(source);

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
			components?: (ButtonElement | LinkButtonElement)[];
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

// Constructores funcionales interactivos
export const Button = (options: { id?: string; label: string; onClick: (event: ClickEvent) => void | Promise<void> }) => new ButtonElement(options);
export const LinkButton = (options: { label: string; url: string }) => new LinkButtonElement(options);
export const RichMessage = (text: string, options?: { footer?: string; header?: string; components?: (ButtonElement | LinkButtonElement)[] }) => new RichMessageElement(text, options);
export const List = (
	idOrConfig: string | { title: string; text: string; buttonText: string; sections: ListSectionOption[]; footer?: string },
	config?: { title: string; text: string; buttonText: string; sections: ListSectionOption[]; footer?: string }
) => new ListElement(idOrConfig, config);
