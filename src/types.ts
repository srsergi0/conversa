import type { WAMessage } from 'baileys';
import type { Thread } from './thread';
import type { Message } from './message';
import type { Button } from './button';

export interface Author {
	id: string; // El JID o identificador del participante
	name?: string; // Nombre visible
	isBot: boolean;
}

export interface FileUpload {
	data: Buffer | Blob | ArrayBuffer;
	filename: string;
	mimeType?: string;
}

export interface PostableObject {
	text?: string;
	raw?: string;
	markdown?: string;
	files?: FileUpload[];
}

export interface ClickEvent {
	thread: Thread;
	author: Author;
	buttonLabel: string;
	messageId: string;
	raw: WAMessage;
}

export interface ButtonOption {
	label: string;
	onClick: (event: ClickEvent) => void | Promise<void>;
}

export interface PostableButtons {
	text: string;
	footer?: string;
	header?: string;
	buttons: ButtonOption[];
}

export interface ConversaContext {
	sessionId: string;
	thread: Thread;
	message: Message;
	author: Author;
	text: string;
	isMention: boolean;
	reply: (content: PostableMessage) => Promise<any>;
	react: (emoji: string) => Promise<any>;
}

export type PostableMessage = string | PostableObject | PostableButtons | Button;


