#!/bin/bash

# Deploy RMM System to DMH-Dashboard
# Usage: ./deploy-rmm-to-dmh.sh /path/to/dmh-dashboard

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-dmh-dashboard>"
    echo "Example: $0 ../DMH-Dashboard"
    exit 1
fi

DMH_PATH="$1"

if [ ! -d "$DMH_PATH" ]; then
    echo "Error: DMH-Dashboard directory not found at $DMH_PATH"
    exit 1
fi

echo "🚀 Deploying RMM System to DMH-Dashboard..."

# Create directories if they don't exist
mkdir -p "$DMH_PATH/lib"
mkdir -p "$DMH_PATH/app/api"
mkdir -p "$DMH_PATH/components"
mkdir -p "$DMH_PATH/app"

# Copy RMM files
echo "📁 Copying RMM cache system..."
cp lib/rmmCache.ts "$DMH_PATH/lib/"

echo "📁 Copying API routes..."
cp -r app/api/rmm/ "$DMH_PATH/app/api/"

echo "📁 Copying UI components..."
cp -r components/rmm/ "$DMH_PATH/components/"

# Copy RMM pages and layout - need to create these manually
echo "📁 Creating RMM pages..."

# Create main RMM page
cat > "$DMH_PATH/app/page.tsx" << 'PAGEEOF'
'use client'

import { useEffect, useState } from 'react'
import RMMCustomerDashboard from '@/components/rmm/RMMCustomerDashboard'

export default function RMMPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            DMH Remote Monitoring & Management
          </h1>
          <p className="mt-2 text-gray-600">
            Monitor and manage all your client endpoints from one dashboard
          </p>
        </div>
        <RMMCustomerDashboard />
      </div>
    </div>
  )
}
PAGEEOF

# Copy agent files
echo "📁 Copying agent package..."
cp -r rmm-agent/ "$DMH_PATH/rmm-agent/"

# Create environment file
echo "🔧 Creating environment configuration..."
cat > "$DMH_PATH/.env.local" << EOF
# RMM System Configuration
RMM_API_KEY=4e3cee998a49247f7a7de5148d11e7d0d67260a43760e6855a5b7920fe704d0e
EOF

# Create package.json if it doesn't exist
if [ ! -f "$DMH_PATH/package.json" ]; then
    echo "📦 Creating package.json..."
    cat > "$DMH_PATH/package.json" << EOF
{
  "name": "dmh-rmm-dashboard",
  "version": "1.0.0",
  "description": "DMH Remote Monitoring & Management Dashboard",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.0.0",
    "@types/node": "^20.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "@tailwindcss/forms": "^0.5.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
EOF
fi

# Create next.config.js if it doesn't exist
if [ ! -f "$DMH_PATH/next.config.js" ]; then
    echo "⚙️ Creating Next.js configuration..."
    cat > "$DMH_PATH/next.config.js" << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};

module.exports = nextConfig;
EOF
fi

echo "✅ RMM System deployed to DMH-Dashboard!"
echo ""
echo "Next steps:"
echo "1. cd $DMH_PATH"
echo "2. npm install"
echo "3. npm run dev"
echo "4. Open http://localhost:3000 (or whatever port Next.js assigns)"
echo ""
echo "Agent configuration:"
echo "- Dashboard URL: http://localhost:3000 (or your DMH-Dashboard URL)"
echo "- API Key: 4e3cee998a49247f7a7de5148d11e7d0d67260a43760e6855a5b7920fe704d0e"
echo ""
echo "🎉 Your standalone RMM system is ready!"