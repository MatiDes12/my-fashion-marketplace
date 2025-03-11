declare module './sign-util-lib' {
  export const pmlib: {
    rs: {
      KJUR: {
        crypto: {
          Signature: new (config: { alg: string }) => {
            init: (privateKey: string) => void;
            updateString: (str: string) => void;
            sign: () => string;
          };
        };
      };
      hextob64: (hex: string) => string;
    };
  };
} 