import React from 'react';

export default function Careers() {
  const positions = [
    {
      title: 'Security Engineer',
      department: 'Information Security',
      type: 'Full-time',
      location: 'Remote / On-site',
      description: 'We are looking for a Security Engineer to help protect our platform and users. You will be responsible for implementing security measures, conducting security assessments, and responding to security incidents.',
      requirements: [
        "Bachelor's degree in Computer Science, Cybersecurity, or related field",
        "3+ years of experience in information security",
        "Experience with web application security",
        "Knowledge of OWASP Top 10 and security best practices",
        "Experience with security tools and frameworks"
      ]
    },
    {
      title: 'Full Stack Developer',
      department: 'Engineering',
      type: 'Full-time',
      location: 'Remote / On-site',
      description: 'Join our engineering team to build and maintain secure, scalable web applications. You will work on both frontend and backend development with a focus on security best practices.',
      requirements: [
        'Experience with React, Next.js, and TypeScript',
        'Strong understanding of web security principles',
        'Experience with API development and security',
        'Knowledge of database security best practices',
        'Familiarity with cloud security concepts'
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="bg-white shadow-sm rounded-lg p-8 mb-8">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Careers at Avriox Shop</h1>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Join Our Team</h2>
          <p className="mb-4 text-gray-700">
            At Avriox Shop, we're building the future of secure e-commerce. We're looking for talented individuals who are passionate about security and want to make a difference.
          </p>
          <p className="mb-4 text-gray-700">
            We offer competitive salaries, comprehensive benefits, and a culture that values security, innovation, and continuous learning.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900">Open Positions</h2>
          <div className="grid gap-6">
            {positions.map((position, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-6 bg-gray-50 hover:bg-white hover:shadow-md transition-all">
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{position.title}</h3>
                <div className="flex gap-4 mb-4 text-sm text-gray-600">
                  <span>{position.department}</span>
                  <span>•</span>
                  <span>{position.type}</span>
                  <span>•</span>
                  <span>{position.location}</span>
                </div>
                <p className="mb-4 text-gray-700">{position.description}</p>
                <div className="mb-4">
                  <h4 className="font-semibold mb-2 text-gray-900">Requirements:</h4>
                  <ul className="list-disc ml-6 text-gray-700 space-y-1">
                    {position.requirements.map((req, idx) => (
                      <li key={idx} className="mb-1">{req}</li>
                    ))}
                  </ul>
                </div>
                <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors font-medium">
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Benefits</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Health & Wellness</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Comprehensive health insurance</li>
                <li>Dental and vision coverage</li>
                <li>Mental health support</li>
                <li>Fitness reimbursement</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Growth & Development</h3>
              <ul className="list-disc ml-6 text-gray-700 space-y-2">
                <li>Professional development budget</li>
                <li>Conference attendance</li>
                <li>Training and certification support</li>
                <li>Mentorship programs</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">How to Apply</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="mb-4 text-gray-700">
              To apply for any position, please send your resume and cover letter to{' '}
              <a href="mailto:careers@avrioxshop.com" className="text-blue-600 hover:text-blue-800 font-medium">
                careers@avrioxshop.com
              </a>
            </p>
            <p className="text-gray-700">
              Please include the position title in your email subject line and mention any relevant security certifications or experience.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
} 