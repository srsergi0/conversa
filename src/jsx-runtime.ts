export const JSX_SYMBOL = Symbol.for('conversa.jsx');

export interface JSXNode {
	$$typeof: symbol;
	type: any;
	props: any;
}

export function jsx(type: any, props: any, key?: any): JSXNode {
	if (typeof type === 'function') {
		return type(props);
	}
	return {
		$$typeof: JSX_SYMBOL,
		type,
		props: { ...props, ...(key ? { key } : {}) }
	};
}

export const jsxs = jsx;

export const Fragment = (props: any) => props.children;

declare global {
	namespace JSX {
		interface Element extends JSXNode {}
		interface ElementClass {}
		interface IntrinsicElements {
			[elemName: string]: any;
		}
	}
}
