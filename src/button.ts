import type { ButtonOption } from './types';
import { registerStableCallback } from './chat';

export interface ButtonConfig {
	text: string;
	footer?: string;
	header?: string;
	buttons: ButtonOption[];
}

function getHashCode(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const chr = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0;
	}
	return (hash >>> 0).toString(16);
}

export class Button {
	public readonly id: string;
	public readonly config: ButtonConfig;

	constructor(config: ButtonConfig);
	constructor(id: string, config: ButtonConfig);
	constructor(arg1: string | ButtonConfig, arg2?: ButtonConfig) {
		if (typeof arg1 === 'string') {
			this.id = arg1;
			this.config = arg2!;
		} else {
			this.config = arg1;
			// Generar un ID estable combinando el contenido estático del botón (fallback)
			const configStr = [
				this.config.text,
				this.config.footer || '',
				this.config.header || '',
				...this.config.buttons.map(b => b.label)
			].join('|');
			
			this.id = `btn_h_${getHashCode(configStr)}`;
		}

		// Registrar los callbacks de manera persistente al arrancar
		this.config.buttons.forEach((btn, index) => {
			registerStableCallback(this.id, index, btn.onClick);
		});
	}
}
