import type { WAMessage } from 'baileys';
import type { Author } from './types';

export class Message {
	constructor(
		public readonly id: string,
		public readonly text: string,
		public readonly author: Author,
		public readonly timestamp: Date,
		public readonly raw: WAMessage,
		public readonly isMention: boolean
	) {}
}
