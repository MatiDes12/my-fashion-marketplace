import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PickupCodeDisplayProps {
  code: string;
  verified?: boolean;
  verifiedAt?: string;
  className?: string;
}

export default function PickupCodeDisplay({ code, verified, verifiedAt, className = '' }: PickupCodeDisplayProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* QR Code */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <QRCodeSVG 
          value={code}
          size={128}
          level="H"
          includeMargin={true}
        />
      </div>

      {/* Code Display */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">Pickup Code</p>
        <p className="text-xl font-mono font-bold tracking-wider">{code}</p>
        
        {/* Verification Status */}
        {verified && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Verified
            </span>
            {verifiedAt && (
              <p className="mt-1 text-xs text-gray-500">
                Verified on {new Date(verifiedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 