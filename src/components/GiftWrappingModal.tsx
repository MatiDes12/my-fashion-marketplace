// Gift Wrapping Modal - DISABLED
// 'use client';

// import { useState, useEffect } from 'react';
// import { toast } from 'react-hot-toast';
// import { GiftIcon, XMarkIcon } from '@heroicons/react/24/outline';

// interface GiftWrappingOption {
//   id: string;
//   name: string;
//   description: string;
//   price: number;
//   currency: string;
// }

// interface GiftWrappingModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   cartItemId: string;
//   currentGiftWrapping: boolean;
//   currentGiftMessage: string;
//   currentWrappingFee: number;
//   onUpdate: (giftWrapping: boolean, giftMessage: string, wrappingFee: number) => void;
// }

// export default function GiftWrappingModal({
//   isOpen,
//   onClose,
//   cartItemId,
//   currentGiftWrapping,
//   currentGiftMessage,
//   currentWrappingFee,
//   onUpdate
// }: GiftWrappingModalProps) {
//   const [isLoading, setIsLoading] = useState(false);
//   const [giftWrapping, setGiftWrapping] = useState(currentGiftWrapping);
//   const [giftMessage, setGiftMessage] = useState(currentGiftMessage);
//   const [selectedOption, setSelectedOption] = useState<string>('');
//   const [wrappingOptions, setWrappingOptions] = useState<GiftWrappingOption[]>([]);

//   useEffect(() => {
//     if (isOpen) {
//       fetchWrappingOptions();
//     }
//   }, [isOpen]);

//   const fetchWrappingOptions = async () => {
//     try {
//       const response = await fetch('/api/cart/gift-wrapping');
//       const data = await response.json();

//       if (response.ok) {
//         setWrappingOptions(data.options);
//         if (data.options.length > 0) {
//           setSelectedOption(data.options[0].id);
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching wrapping options:', error);
//     }
//   };

//   const handleSave = async () => {
//     setIsLoading(true);
    
//     try {
//       const response = await fetch('/api/cart/gift-wrapping', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           cartItemId,
//           giftWrapping,
//           giftMessage: giftWrapping ? giftMessage : '',
//           wrappingOptionId: giftWrapping ? selectedOption : null,
//         }),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         const selectedWrappingOption = wrappingOptions.find(opt => opt.id === selectedOption);
//         const wrappingFee = giftWrapping && selectedWrappingOption ? selectedWrappingOption.price : 0;
        
//         onUpdate(giftWrapping, giftMessage, wrappingFee);
//         toast.success(data.message);
//         onClose();
//       } else {
//         toast.error(data.error || 'Failed to update gift wrapping');
//     } catch (error) {
//       console.error('Error updating gift wrapping:', error);
//       toast.error('Failed to update gift wrapping');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const selectedWrappingOption = wrappingOptions.find(opt => opt.id === selectedOption);

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//       <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
//         <div className="p-6">
//           <div className="flex items-center justify-between mb-6">
//             <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
//               <GiftIcon className="h-5 w-5" />
//               Gift Wrapping
//             </h3>
//             <button
//               onClick={onClose}
//               className="text-gray-400 hover:text-gray-600 transition-colors"
//             >
//               <XMarkIcon className="h-5 w-5" />
//             </button>
//           </div>

//           <div className="space-y-6">
//             {/* Gift Wrapping Toggle */}
//             <div className="flex items-center justify-between">
//               <div>
//                 <h4 className="text-sm font-medium text-gray-900">Add Gift Wrapping</h4>
//                 <p className="text-sm text-gray-500">Make it special with beautiful wrapping</p>
//               </div>
//               <label className="relative inline-flex items-center cursor-pointer">
//                 <input
//                   type="checkbox"
//                   checked={giftWrapping}
//                   onChange={(e) => setGiftWrapping(e.target.checked)}
//                   className="sr-only peer"
//                 />
//                 <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
//               </label>
//             </div>

//             {giftWrapping && (
//               <>
//                 {/* Wrapping Options */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-3">
//                     Choose Wrapping Style
//                   </label>
//                   <div className="space-y-3">
//                     {wrappingOptions.map((option) => (
//                       <label
//                         key={option.id}
//                         className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
//                           selectedOption === option.id
//                             ? 'border-green-500 bg-green-50'
//                             : 'border-gray-200 hover:border-gray-300'
//                         }`}
//                       >
//                         <input
//                           type="radio"
//                           name="wrappingOption"
//                           value={option.id}
//                           checked={selectedOption === option.id}
//                           onChange={(e) => setSelectedOption(e.target.value)}
//                           className="sr-only"
//                         />
//                         <div className="flex-1">
//                           <div className="flex items-center justify-between">
//                             <div>
//                               <p className="text-sm font-medium text-gray-900">{option.name}</p>
//                               <p className="text-sm text-gray-500">{option.description}</p>
//                             </div>
//                             <p className="text-sm font-semibold text-gray-900">
//                               ETB {option.price.toFixed(2)}
//                             </p>
//                           </div>
//                         </div>
//                       </label>
//                     ))}
//                   </div>
//                 </div>

//                 {/* Gift Message */}
//                 <div>
//                   <label htmlFor="giftMessage" className="block text-sm font-medium text-gray-700 mb-2">
//                     Gift Message (optional)
//                   </label>
//                   <textarea
//                     id="giftMessage"
//                     value={giftMessage}
//                     onChange={(e) => setGiftMessage(e.target.value)}
//                     rows={3}
//                     maxLength={200}
//                     placeholder="Write a personal message for the recipient..."
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
//                   />
//                   <p className="text-xs text-gray-500 mt-1">
//                     {giftMessage.length}/200 characters
//                   </p>
//                 </div>

//                 {/* Summary */}
//                 {selectedWrappingOption && (
//                   <div className="bg-gray-50 p-4 rounded-lg">
//                     <h4 className="text-sm font-medium text-gray-900 mb-2">Summary</h4>
//                     <div className="space-y-1 text-sm">
//                       <div className="flex justify-between">
//                         <span className="text-gray-600">Wrapping Style:</span>
//                         <span className="text-gray-900">{selectedWrappingOption.name}</span>
//                       </div>
//                       <div className="flex justify-between">
//                         <div className="flex justify-between">
//                         <span className="text-gray-600">Wrapping Fee:</span>
//                         <span className="text-gray-900">ETB {selectedWrappingOption.price.toFixed(2)}</span>
//                       </div>
//                       {giftMessage && (
//                         <div className="flex justify-between">
//                           <span className="text-gray-600">Gift Message:</span>
//                           <span className="text-gray-900">✓ Added</span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 )}
//               </>
//             )}

//             {/* Action Buttons */}
//             <div className="flex gap-3 pt-4">
//               <button
//                 onClick={onClose}
//                 className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={handleSave}
//                 disabled={isLoading || (giftWrapping && !selectedOption)}
//                 className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {isLoading ? 'Saving...' : 'Save Changes'}
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// Export empty object to make this a valid module
export {};
