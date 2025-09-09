'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0b6d41] rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Evently</h2>
              <p className="text-xs text-gray-500">Event Platform</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 text-sm text-gray-600">
            <Link 
              href="/terms-and-conditions" 
              className="hover:text-[#0b6d41] transition-colors"
            >
              Terms and Conditions
            </Link>
            <span className="hidden md:inline text-gray-400">•</span>
            <span className="text-center font-medium">
              Owned by JICATE Solutions Private Limited
            </span>
            <span className="hidden md:inline text-gray-400">•</span>
            <span className="text-center">
              Developed by ROJA SUNDHARAM
            </span>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-4 pt-4 border-t border-gray-100 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} JICATE Solutions Private Limited. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
