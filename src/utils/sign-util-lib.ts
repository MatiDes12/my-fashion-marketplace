// Create a module-level variable to store the pmlib
let pmlibInstance: any;

// Define interfaces for type safety
interface PrivateKey {
  sign(data: string, algorithm: string): string;
}

interface Signature {
  init(t: string): void;
  updateString(t: string): void;
  sign(): string;
  prvKey?: PrivateKey;
  sHashHex?: string;
}

interface KJUR {
  crypto: {
    Signature: new (t: any) => Signature;
  };
}

interface RS {
  KJUR: KJUR;
  hextob64(t: string): string;
}

// Initialize the library
const initPmlib = () => {
  const t: { rs: RS } = {
    rs: {
      KJUR: {
        crypto: {
          Signature: function(this: Signature, t: any) {
            this.init = function(t: string) {
              // In reality, t is a private key object with sign method
              this.prvKey = t as unknown as PrivateKey;
            };
            this.updateString = function(t: string) {
              this.sHashHex = t;
            };
            this.sign = function() {
              const t = this.prvKey;
              const n = this.sHashHex;
              if (!t || !n) throw new Error('Private key or hash not set');
              const r = t.sign(n, "sha256");
              return r;
            };
          } as any as new (t: any) => Signature
        }
      },
      hextob64: function(t: string) {
        let n = "";
        let r = 0;
        let i = 0;
        let s = 0;
        let o = 0;
        
        for (let u = 0; u < t.length; u += 2) {
          const a = parseInt(t.substr(u, 2), 16);
          if (i == 0) {
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              a >> 2
            );
            r = (a & 3) << 4;
            i = 1;
          } else if (i == 1) {
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              (r as number) | (a >> 4)
            );
            r = (a & 15) << 2;
            i = 2;
          } else if (i == 2) {
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              (r as number) | (a >> 6)
            );
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              a & 63
            );
            i = 0;
          }
          s += 2;
          if (s >= 64) {
            s = 0;
            o++;
          }
        }
        
        if (i == 1) {
          n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
            r as number
          );
          n += "==";
        } else if (i == 2) {
          n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
            r as number
          );
          n += "=";
        }
        return n;
      }
    }
  };
  return t;
};

// Initialize the library if it hasn't been initialized
if (!pmlibInstance) {
  pmlibInstance = initPmlib();
}

// Export the initialized instance
export const pmlib = pmlibInstance;

// TypeScript type declarations
declare global {
  interface Window {
    pmlib: typeof pmlibInstance;
  }
} 