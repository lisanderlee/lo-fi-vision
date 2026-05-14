// Ambient JSX shim. This project doesn't install @types/react, so the
// global JSX namespace has no IntrinsicAttributes definition — which means
// `key` and `ref` aren't recognised as JSX-only props on plain function
// components, and `<MyComponent key="x" />` fails to type-check unless the
// component's prop type happens to include `key`.
//
// External component libraries (motion, lucide-react) work around this with
// their own typings. For our local components we declare the missing
// JSX.IntrinsicAttributes here once, project-wide.
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | null;
    }
  }
}

export {};
