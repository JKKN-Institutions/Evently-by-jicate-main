import { Settings } from 'lucide-react'

export default function AdminSettingsPage() {
  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-[#0b6d41]" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
                <p className="text-gray-600 mt-1">Configure system settings and preferences</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Admin Settings</h2>
            <p className="text-gray-600">Admin settings panel will be available here.</p>
          </div>
        </div>
      </div>
    </>
  )
}
