export class Channel {
	constructor(
		public readonly id: string, // Formato: `sessionId:jid`
		public readonly jid: string,
		public readonly isGroup: boolean
	) {}
}
