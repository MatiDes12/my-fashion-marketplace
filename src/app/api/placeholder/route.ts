import { NextResponse } from 'next/server';

export async function GET() {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#f3f4f6" />
      <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">
        Image Not Available
      </text>
    </svg>
  `;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
} 