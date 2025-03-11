// Create a module-level variable to store the pmlib
let pmlibInstance: any;

// Initialize the library
const initPmlib = () => {
  const t = {
    rs: {
      KJUR: {
        crypto: {
          Signature: function(t: any) {
            this.init = function(t: string) {
              this.prvKey = t;
            };
            this.updateString = function(t: string) {
              this.sHashHex = t;
            };
            this.sign = function() {
              var t = this.prvKey;
              var n = this.sHashHex;
              var r = t.sign(n, "sha256");
              return r;
            };
          }
        }
      },
      hextob64: function(t: string) {
        var n = "";
        var r = "";
        var i = 0;
        var s = 0;
        var o = 0;
        for (var u = 0; u < t.length; u += 2) {
          var a = parseInt(t.substr(u, 2), 16);
          if (i == 0) {
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              a >> 2
            );
            r = (a & 3) << 4;
            i = 1;
          } else if (i == 1) {
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              r | (a >> 4)
            );
            r = (a & 15) << 2;
            i = 2;
          } else if (i == 2) {
            n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
              r | (a >> 6)
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
            r
          );
          n += "==";
        } else if (i == 2) {
          n += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(
            r
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