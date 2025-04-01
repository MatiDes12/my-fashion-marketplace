'use client';

import { useState } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const REGIONS = [
  { value: 'addis_ababa', label: 'Addis Ababa' },
  { value: 'dire_dawa', label: 'Dire Dawa' },
  { value: 'tigray', label: 'Tigray' },
  { value: 'afar', label: 'Afar' },
  { value: 'amhara', label: 'Amhara' },
  { value: 'oromia', label: 'Oromia' },
  { value: 'somali', label: 'Somali' },
  { value: 'benishangul_gumuz', label: 'Benishangul-Gumuz' },
  { value: 'snnpr', label: 'Southern Nations, Nationalities and Peoples Region (SNNPR)' },
  { value: 'gambela', label: 'Gambela' },
  { value: 'harari', label: 'Harari' }
];

type FormStep = 'business' | 'address' | 'documents';

interface FormData {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  legalBusinessName: string;
  businessRegistrationNo: string;
  tinNumber: string;
  vatNumber: string;
  isVatRegistered: boolean;
  region: string;
  kifleKetema: string;
  woreda: string;
  kebele: string;
  houseNo: string;
  idDocumentType: 'kebele_id' | 'national_id' | 'passport' | 'driving_license';
}

interface FileData {
  tradeLicense: File | null;
  tinCertificate: File | null;
  memorandum: File | null;
  idDocument: File | null;
}

export default function SellerVerificationForm() {
  const [currentStep, setCurrentStep] = useState<FormStep>('business');
  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    legalBusinessName: '',
    businessRegistrationNo: '',
    tinNumber: '',
    vatNumber: '',
    isVatRegistered: false,
    region: '',
    kifleKetema: '',
    woreda: '',
    kebele: '',
    houseNo: '',
    idDocumentType: 'national_id',
  });

  const [files, setFiles] = useState<FileData>({
    tradeLicense: null,
    tinCertificate: null,
    memorandum: null,
    idDocument: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClientComponent();

  const steps: FormStep[] = ['business', 'address', 'documents'];
  const currentStepIndex = steps.indexOf(currentStep);

  const goToNextStep = () => {
    let isValid = false;
    
    switch (currentStep) {
      case 'business':
        isValid = validateBusinessStep();
        break;
      case 'address':
        isValid = validateAddressStep();
        break;
      case 'documents':
        isValid = validateDocumentsStep();
        break;
    }

    if (!isValid) {
      setError('Please fill in all required fields before proceeding');
      return;
    }

    setError(''); // Clear any existing error
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              index <= currentStepIndex ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-1 w-12 ${
                index < currentStepIndex ? 'bg-red-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderBusinessInfo = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="businessName"
              required
              value={formData.businessName}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="businessEmail"
              required
              value={formData.businessEmail}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="business@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="businessPhone"
              required
              value={formData.businessPhone}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="+251..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Legal Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="legalBusinessName"
              required
              value={formData.legalBusinessName}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Legal registered name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Registration No <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="businessRegistrationNo"
              required
              value={formData.businessRegistrationNo}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Registration number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              TIN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="tinNumber"
              required
              value={formData.tinNumber}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Tax Identification Number"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              VAT Registration
            </label>
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="isVatRegistered"
                  checked={formData.isVatRegistered}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span className="ml-2 text-sm text-gray-600">VAT Registered</span>
              </label>
            </div>
            
            {formData.isVatRegistered && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="vatNumber"
                  required
                  value={formData.vatNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Enter VAT registration number"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Document Type <span className="text-red-500">*</span>
            </label>
            <select
              name="idDocumentType"
              required
              value={formData.idDocumentType}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="kebele_id">Kebele ID</option>
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderAddressInfo = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Region <span className="text-red-500">*</span>
            </label>
            <select
              name="region"
              required
              value={formData.region}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select a region</option>
              {REGIONS.map(region => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kifle Ketema <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="kifleKetema"
              required
              value={formData.kifleKetema}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Sub-city/Kifle Ketema"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Woreda <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="woreda"
              required
              value={formData.woreda}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Woreda number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kebele
            </label>
            <input
              type="text"
              name="kebele"
              value={formData.kebele}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Kebele number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              House No. <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="houseNo"
              required
              value={formData.houseNo}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="House number"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const FileUploadField = ({ 
    label, 
    fileType, 
    file 
  }: { 
    label: string; 
    fileType: keyof FileData; 
    file: File | null;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-red-500 transition-colors">
        <div className="space-y-1 text-center">
          {file ? (
            <div className="text-sm text-gray-600">
              Selected: {file.name}
              <button
                type="button"
                onClick={() => setFiles(prev => ({ ...prev, [fileType]: null }))}
                className="ml-2 text-red-600 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex text-sm text-gray-600 justify-center">
                <label className="relative cursor-pointer rounded-md font-medium text-red-600 hover:text-red-500">
                  <span>Upload a file</span>
                  <input
                    type="file"
                    className="sr-only"
                    required
                    onChange={(e) => handleFileChange(e, fileType)}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderDocumentUpload = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Required Documents</h3>
        <p className="text-sm text-gray-500">Please upload all required documents in PDF, PNG, or JPG format</p>
        
        <div className="grid grid-cols-1 gap-6">
          <FileUploadField label="Trade License" fileType="tradeLicense" file={files.tradeLicense} />
          <FileUploadField label="TIN Certificate" fileType="tinCertificate" file={files.tinCertificate} />
          <FileUploadField label="Memorandum of Association" fileType="memorandum" file={files.memorandum} />
          <FileUploadField label="ID Document" fileType="idDocument" file={files.idDocument} />
        </div>
      </div>
    </motion.div>
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: keyof FileData) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({
        ...prev,
        [fileType]: e.target.files![0]
      }));
    }
  };

  const validateBusinessStep = () => {
    const requiredFields = [
      'businessName',
      'businessEmail',
      'businessPhone',
      'legalBusinessName',
      'businessRegistrationNo',
      'tinNumber',
      'idDocumentType'
    ];

    const missingFields = requiredFields.filter(field => !formData[field as keyof FormData]);
    
    if (formData.isVatRegistered && !formData.vatNumber) {
      missingFields.push('vatNumber');
    }

    return missingFields.length === 0;
  };

  const validateAddressStep = () => {
    const requiredFields = [
      'region',
      'kifleKetema',
      'woreda',
      'houseNo'
    ];

    return requiredFields.every(field => formData[field as keyof FormData]);
  };

  const validateDocumentsStep = () => {
    const requiredFiles = [
      'tradeLicense',
      'tinCertificate',
      'idDocument'
    ];

    return requiredFiles.every(file => files[file as keyof FileData]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all steps before submission
    if (!validateBusinessStep() || !validateAddressStep() || !validateDocumentsStep()) {
      setError('Please fill in all required fields before submitting');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }

      // Upload files to storage
      const uploadFile = async (file: File, path: string) => {
        // Create a unique filename using timestamp
        const timestamp = new Date().getTime();
        const fileExt = file.name.split('.').pop();
        const fileName = `${path}-${timestamp}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('verification-documents')
          .upload(`${session.user.id}/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false // Prevent overwriting existing files
          });
        
        if (error) throw error;
        return data.path;
      };

      const fileUrls = {
        tradeLicense: files.tradeLicense 
          ? await uploadFile(files.tradeLicense, 'trade-license')
          : null,
        tinCertificate: files.tinCertificate 
          ? await uploadFile(files.tinCertificate, 'tin-certificate')
          : null,
        memorandum: files.memorandum 
          ? await uploadFile(files.memorandum, 'memorandum')
          : null,
        idDocument: files.idDocument 
          ? await uploadFile(files.idDocument, 'id-document')
          : null,
      };

      // Insert verification data
      const { error: verificationError } = await supabase
        .from('seller_verification')
        .insert({
          user_id: session.user.id,
          business_name: formData.businessName,
          business_email: formData.businessEmail,
          business_phone: formData.businessPhone,
          legal_business_name: formData.legalBusinessName,
          business_registration_no: formData.businessRegistrationNo,
          tin_number: formData.tinNumber,
          is_vat_registered: formData.isVatRegistered,
          ...(formData.isVatRegistered && { vat_number: formData.vatNumber }),
          trade_license_url: fileUrls.tradeLicense,
          tin_certificate_url: fileUrls.tinCertificate,
          memorandum_url: fileUrls.memorandum,
          region: formData.region,
          kifle_ketema: formData.kifleKetema,
          woreda: formData.woreda,
          kebele: formData.kebele,
          house_no: formData.houseNo,
          id_document_type: formData.idDocumentType,
          id_document_url: fileUrls.idDocument,
          status: 'pending'
        });

      if (verificationError) throw verificationError;

      router.push('/dashboard/verification-pending');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Seller Verification</h2>
          <p className="text-red-100 text-sm mt-1">Step {currentStepIndex + 1} of {steps.length}</p>
        </div>

        <div className="p-6">
          {renderStepIndicator()}
          
          <AnimatePresence mode="wait">
            {currentStep === 'business' && renderBusinessInfo()}
            {currentStep === 'address' && renderAddressInfo()}
            {currentStep === 'documents' && renderDocumentUpload()}
          </AnimatePresence>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button
              type="button"
              onClick={goToPreviousStep}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                currentStepIndex === 0
                  ? 'invisible'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Previous
            </button>
            
            {currentStepIndex === steps.length - 1 ? (
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
} 