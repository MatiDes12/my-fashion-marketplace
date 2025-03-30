'use client';

import { useState } from 'react';
import { CATEGORY_SPECIFIC_FIELDS, COMMON_SPECIFICATIONS, WARRANTY_PERIODS } from '@/utils/constants';

type DynamicProductFieldsProps = {
  category: string;
  specifications: { [key: string]: string };
  setSpecifications: (specs: { [key: string]: string }) => void;
  measurements: { [key: string]: string };
  setMeasurements: (measurements: { [key: string]: string }) => void;
  inputClasses: string;
  selectClasses: string;
};

export default function DynamicProductFields({
  category,
  specifications,
  setSpecifications,
  measurements,
  setMeasurements,
  inputClasses,
  selectClasses
}: DynamicProductFieldsProps) {
  const categoryConfig = CATEGORY_SPECIFIC_FIELDS[category as keyof typeof CATEGORY_SPECIFIC_FIELDS] 
    || CATEGORY_SPECIFIC_FIELDS.default;

  // Only show measurements that aren't already shown in category-specific measurements
  const commonMeasurements = ['Length', 'Width', 'Height', 'Weight'].filter(
    m => !categoryConfig.measurements?.includes(m)
  );

  return (
    <div className="space-y-6">
      {/* Category-specific Specifications */}
      {categoryConfig.specifications && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900">
            {category} Specifications
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categoryConfig.specifications.map((spec) => (
              <div key={spec}>
                <label className="block text-sm font-medium text-gray-700">
                  {spec}
                </label>
                <input
                  type="text"
                  value={specifications[spec] || ''}
                  onChange={(e) => setSpecifications({
                    ...specifications,
                    [spec]: e.target.value
                  })}
                  className={inputClasses}
                  placeholder={`Enter ${spec.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Specifications - only show if not in category-specific */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-base font-medium text-gray-900">
          General Specifications
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMMON_SPECIFICATIONS.filter(
            spec => !categoryConfig.specifications?.includes(spec)
          ).map((spec) => (
            <div key={spec}>
              <label className="block text-sm font-medium text-gray-700">
                {spec.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </label>
              {spec === 'warranty_period' ? (
                <select
                  value={specifications[spec] || ''}
                  onChange={(e) => setSpecifications({
                    ...specifications,
                    [spec]: e.target.value
                  })}
                  className={selectClasses}
                >
                  <option value="">Select warranty period</option>
                  {WARRANTY_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={specifications[spec] || ''}
                  onChange={(e) => setSpecifications({
                    ...specifications,
                    [spec]: e.target.value
                  })}
                  className={inputClasses}
                  placeholder={`Enter ${spec.split('_').join(' ').toLowerCase()}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Common Measurements - only if not in category-specific */}
      {commonMeasurements.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-base font-medium text-gray-900">
            Product Measurements
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {commonMeasurements.map((measurement) => (
              <div key={measurement}>
                <label className="block text-sm font-medium text-gray-700">
                  {measurement}
                </label>
                <input
                  type="text"
                  value={measurements[measurement] || ''}
                  onChange={(e) => setMeasurements({
                    ...measurements,
                    [measurement]: e.target.value
                  })}
                  className={inputClasses}
                  placeholder={`Enter ${measurement.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 