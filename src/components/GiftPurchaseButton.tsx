// Gift Purchase Button - DISABLED
// 'use client';

// import { useState } from 'react';
// import { toast } from 'react-hot-toast';
// import { GiftIcon, ShareIcon } from '@heroicons/react/24/outline';

// interface GiftPurchaseButtonProps {
//   productId: string;
//   productTitle: string;
//   productPrice: number;
//   quantity?: number;
//   selectedSize?: string;
//   selectedColor?: string;
//   selectedVariantSku?: string;
// }

// export default function GiftPurchaseButton({
//   productId,
//   productTitle,
//   productPrice,
//   quantity = 1,
//   selectedSize,
//   selectedColor,
//   selectedVariantSku
// }: GiftPurchaseButtonProps) {
//   const [isLoading, setIsLoading] = useState(false);
//   const [showModal, setShowModal] = useState(false);
//   const [giftWrapping, setGiftWrapping] = useState(false);
//   const [giftMessage, setGiftMessage] = useState('');
//   const [wrappingOptionId, setWrappingOptionId] = useState('');
//   const [recipientEmail, setRecipientEmail] = useState('');
//   const [recipientName, setRecipientName] = useState('');
//   const [expiresInDays, setExpiresInDays] = useState(30);
//   const [wrappingOptions, setWrappingOptions] = useState<any[]>([]);

//   const handleCreateGiftLink = async () => {
//     if (!recipientName) {
//       toast.error('Please enter recipient name');
//       return;
//     }

//     if (giftWrapping && !wrappingOptionId) {
//       toast.error('Please select a gift wrapping option');
//       return;
//     }

//     setIsLoading(true);
    
//     try {
//       const response = await fetch('/api/gift-purchase/create', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           productId,
//           productTitle,
//           productPrice,
//           quantity,
//           selectedSize,
//           selectedColor,
//           selectedVariantSku,
//           recipientEmail: recipientEmail || null,
//           recipientName,
//           giftWrapping,
//           giftMessage: giftMessage || null,
//           wrappingOptionId: wrappingOptionId || null,
//           expiresInDays
//         }),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         const giftLink = `${window.location.origin}/gift-purchase/${data.linkCode}`;
        
//         // Copy to clipboard
//         await navigator.clipboard.writeText(giftLink);
//         toast.success('Gift link created and copied to clipboard!');
        
//         setShowModal(false);
//         // Reset form
//         setRecipientEmail('');
//         setRecipientName('');
//         setGiftMessage('');
//         setGiftWrapping(false);
//         setWrappingOptionId('');
//       } else {
//         toast.error(data.error || 'Failed to create gift link');
//       }
//     } catch (error) {
//       console.error('Error creating gift link:', error);
//       toast.error('Failed to create gift link');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const fetchWrappingOptions = async () => {
//     try {
//       const response = await fetch('/api/cart/gift-wrapping');
//       const data = await response.json();

//       if (response.ok) {
//         setWrappingOptions(data.options);
//         if (data.options.length > 0) {
//           setWrappingOptionId(data.options[0].id);
//         }
//       }
//     } catch (error) {
//       console.error('Error fetching wrapping options:', error);
//     }
//   };

//   return (
//     <>
//       <button
//         onClick={() => {
//           setShowModal(true);
//           if (giftWrapping) {
//             fetchWrappingOptions();
//           }
//         }}
//         className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
//       >
//         <GiftIcon className="h-5 w-5" />
//         Gift This Item
//       </button>

//       {/* Gift Purchase Modal */}
//       {showModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//           <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
//             <div className="p-6">
//               <div className="flex items-center justify-between mb-6">
//                 <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
//                   <GiftIcon className="h-5 w-5" />
//                   Create Gift Purchase Link
//                 </h3>
//                 <button
//                   onClick={() => setShowModal(false)}
//                   className="text-gray-400 hover:text-gray-600 transition-colors"
//                 >
//                   <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
//                   </svg>
//                 </button>
//               </div>

//               <div className="space-y-6">
//                 {/* Product Summary */}
//                 <div className="bg-gray-50 p-4 rounded-lg">
//                   <h4 className="text-sm font-medium text-gray-900 mb-2">Product</h4>
//                   <p className="text-sm text-gray-600">{productTitle}</p>
//                   <p className="text-sm text-gray-600">Quantity: {quantity}</p>
//                   <p className="text-sm font-semibold text-gray-900">Price: ETB {productPrice.toFixed(2)}</p>
//                   {selectedSize && <p className="text-sm text-gray-600">Size: {selectedSize}</p>}
//                   {selectedColor && <p className="text-sm text-gray-600">Color: {selectedColor}</p>}
//                 </div>

//                 {/* Recipient Details */}
//                 <div>
//                   <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">
//                     Recipient Name *
//                   </label>
//                   <input
//                     type="text"
//                     id="recipientName"
//                     value={recipientName}
//                     onChange={(e) => setRecipientName(e.target.value)}
//                     placeholder="Who is this gift for?"
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                     required
//                   />
//                 </div>

//                 <div>
//                   <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
//                     Recipient Email (optional)
//                   </label>
//                   <input
//                     type="email"
//                     id="recipientEmail"
//                     value={recipientEmail}
//                     onChange={(e) => setRecipientEmail(e.target.value)}
//                     placeholder="Send notification to recipient"
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                   />
//                 </div>

//                 {/* Gift Wrapping */}
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <h4 className="text-sm font-medium text-gray-900">Add Gift Wrapping</h4>
//                     <p className="text-sm text-gray-500">Make it extra special</p>
//                   </div>
//                   <label className="relative inline-flex items-center cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={giftWrapping}
//                       onChange={(e) => {
//                         setGiftWrapping(e.target.checked);
//                         if (e.target.checked) {
//                           fetchWrappingOptions();
//                         }
//                       }}
//                       className="sr-only peer"
//                     />
//                     <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
//                   </label>
//                 </div>

//                 {giftWrapping && (
//                   <>
//                     {/* Wrapping Options */}
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-3">
//                         Choose Wrapping Style
//                       </label>
//                       <div className="space-y-3">
//                         {wrappingOptions.map((option) => (
//                           <label
//                             key={option.id}
//                             className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
//                               wrappingOptionId === option.id
//                                 ? 'border-purple-500 bg-purple-50'
//                                 : 'border-gray-200 hover:border-gray-300'
//                             }`}
//                           >
//                             <input
//                               type="radio"
//                               name="wrappingOption"
//                               value={option.id}
//                               checked={wrappingOptionId === option.id}
//                               onChange={(e) => setWrappingOptionId(e.target.value)}
//                               className="sr-only"
//                             />
//                             <div className="flex-1">
//                               <div className="flex items-center justify-between">
//                                 <div>
//                                   <p className="text-sm font-medium text-gray-900">{option.name}</p>
//                                   <p className="text-sm text-gray-500">{option.description}</p>
//                                 </div>
//                                 <p className="text-sm font-semibold text-gray-900">
//                                   ETB {option.price.toFixed(2)}
//                                 </p>
//                               </div>
//                             </div>
//                           </label>
//                         ))}
//                       </div>
//                     </div>

//                     {/* Gift Message */}
//                     <div>
//                       <label htmlFor="giftMessage" className="block text-sm font-medium text-gray-700 mb-2">
//                         Gift Message (optional)
//                       </label>
//                       <textarea
//                         id="giftMessage"
//                         value={giftMessage}
//                         onChange={(e) => setGiftMessage(e.target.value)}
//                         rows={3}
//                         maxLength={200}
//                         placeholder="Write a personal message..."
//                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
//                       />
//                       <p className="text-xs text-gray-500 mt-1">
//                         {giftMessage.length}/200 characters
//                       </p>
//                     </div>
//                   </>
//                 )}

//                 {/* Link Expiry */}
//                 <div>
//                   <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700 mb-1">
//                     Link Expires In
//                   </label>
//                   <select
//                     id="expiresInDays"
//                     value={expiresInDays}
//                     onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
//                   >
//                     <option value={7}>7 days</option>
//                     <option value={14}>14 days</option>
//                     <option value={30}>30 days</option>
//                     <option value={60}>60 days</option>
//                     <option value={90}>90 days</option>
//                   </select>
//                 </div>

//                 {/* Action Buttons */}
//                 <div className="flex gap-3 pt-4">
//                   <button
//                     onClick={() => setShowModal(false)}
//                     className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
//                   >
//                     Cancel
//                   </button>
//                   <button
//                     onClick={handleCreateGiftLink}
//                     disabled={isLoading || !recipientName || (giftWrapping && !wrappingOptionId)}
//                     className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {isLoading ? 'Creating...' : 'Create Gift Link'}
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// Export empty object to make this a valid module
export {};