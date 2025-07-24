'use client';

import Link from 'next/link';

export default function DeliveryInstructions() {
  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Delivery System Instructions</h1>
            
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">How to Set Up Delivery</h2>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 sm:p-4 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-blue-700">
                    <strong>Step 1:</strong> Create delivery accounts for your delivery persons
                  </p>
                </div>
                <ol className="list-decimal list-inside space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600 pl-2">
                  <li>Go to the "Delivery Accounts" tab</li>
                  <li>Click "Add Delivery Person"</li>
                  <li>Enter the delivery person's name and phone number</li>
                  <li>Optionally add their email address</li>
                  <li>Click "Create Account"</li>
                </ol>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Sharing Access with Delivery Persons</h2>
                <div className="bg-green-50 border-l-4 border-green-400 p-3 sm:p-4 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-green-700">
                    <strong>Important:</strong> Each delivery person gets a unique access code
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                  <h3 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">Access Information</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Login URL:</p>
                      <code className="text-xs sm:text-sm bg-white px-2 py-1 rounded border font-mono break-all">
                        https://www.avrioxshop.com/delivery/login
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Access Code:</p>
                      <p className="text-xs sm:text-sm text-blue-800">The delivery person's phone number</p>
                    </div>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600 pl-2">
                  <li>The access code is the delivery person's phone number</li>
                  <li>Share both the login URL and access code with your delivery person</li>
                  <li>They can access their dashboard at: <code className="bg-gray-100 px-1 rounded text-xs">https://www.avrioxshop.com/delivery/login</code></li>
                  <li>They just need to enter their phone number to access their dashboard</li>
                  <li>Use the "Copy" button in the Delivery Accounts section to easily share access information</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Assigning Deliveries</h2>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-yellow-700">
                    <strong>Note:</strong> Deliveries are automatically assigned when orders are placed
                  </p>
                </div>
                <ol className="list-decimal list-inside space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600 pl-2">
                  <li>Go to the "Delivery Tracking" tab</li>
                  <li>Find orders that need delivery assignment</li>
                  <li>Click "Assign to [Delivery Person]" for each order</li>
                  <li>The delivery person will see the assigned orders in their dashboard</li>
                </ol>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Delivery Status Tracking</h2>
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">Status Types</h3>
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <li><span className="font-medium">Assigned:</span> Order assigned to delivery person</li>
                      <li><span className="font-medium">Picked Up:</span> Delivery person has picked up the order</li>
                      <li><span className="font-medium">In Transit:</span> Order is being delivered</li>
                      <li><span className="font-medium">Delivered:</span> Order successfully delivered</li>
                      <li><span className="font-medium">Failed:</span> Delivery could not be completed</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">What Delivery Persons Can Do</h3>
                    <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <li>View all assigned deliveries</li>
                      <li>Update delivery status</li>
                      <li>Add delivery notes</li>
                      <li>See customer details and delivery address</li>
                      <li>View pickup codes for store pickups</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Example Workflow</h2>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <ol className="list-decimal list-inside space-y-1 sm:space-y-2 text-xs sm:text-sm text-gray-600 pl-2">
                    <li>Customer places an order with delivery</li>
                    <li>You create a delivery account for your delivery person</li>
                    <li>You share the access code (phone number) with the delivery person</li>
                    <li>You assign the order to the delivery person</li>
                    <li>Delivery person logs in with their phone number</li>
                    <li>Delivery person updates status as they progress</li>
                    <li>You can track the delivery status in real-time</li>
                  </ol>
                </div>
              </div>

              <div className="flex justify-center pt-4 sm:pt-6">
                <Link
                  href="/dashboard/delivery"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 w-full sm:w-auto justify-center"
                >
                  Go to Delivery Management
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 