'use client';

import { useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const supabase = createClientComponent();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Settings</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Tabs defaultValue="general" className="w-full">
          <div className="border-b border-gray-200">
            <TabsList className="flex -mb-px space-x-8 px-6">
              <TabsTrigger 
                value="general"
                className="py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap"
              >
                General Settings
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap"
              >
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="general">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900">Coming Soon</h3>
                <p className="mt-2 text-sm text-gray-500">General settings will be available in a future update.</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900">Coming Soon</h3>
                <p className="mt-2 text-sm text-gray-500">Notification settings will be available in a future update.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 