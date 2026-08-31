import React from 'react';
import { usePageMeta } from '../lib/seo';

const TermsOfService = () => {
  usePageMeta({ title: 'Terms of Service', description: 'The terms that govern your use of FileQuick.' });
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
      <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-8">Terms of Service</h1>
      
      <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        <p className="mb-4">
          Welcome to FileQuick!
        </p>
        
        <p className="mb-6">
          These Terms of Service ("Terms") govern your access to and use of FileQuick ("we", "us", or "our") and its services (the "Service"). 
          By accessing or using our Service, you agree to be bound by these Terms. If you do not agree, please do not use the Service.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">1. Consent</h2>
        <p className="mb-4">
          By using FileQuick, you agree to these Terms and our Privacy Policy.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">2. General Conditions</h2>
        <ul className="list-disc ml-6 mb-6">
          <li className="mb-2">Our Service is completely free to use.</li>
          <li className="mb-2">You agree not to misuse, duplicate, sell, or exploit any part of the Service.</li>
          <li className="mb-2">You may not use our Service for any illegal activities.</li>
          <li className="mb-2">We reserve the right to refuse service to anyone at any time.</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">3. Personal Information</h2>
        <p className="mb-6">
          Your personal information is protected as per our Privacy Policy.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">4. Accuracy & Completeness</h2>
        <p className="mb-6">
          We strive to keep the information accurate, but we do not guarantee its completeness or correctness.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">5. Service Availability</h2>
        <p className="mb-6">
          We aim to keep the Service running smoothly, but we do not guarantee uninterrupted access.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">6. Files and Data</h2>
        <ul className="list-disc ml-6 mb-6">
          <li className="mb-2">Most tools process your files entirely in your browser — nothing is uploaded.</li>
          <li className="mb-2">Where a tool uses our conversion server, the file is deleted immediately after processing.</li>
          <li className="mb-2">Always keep a backup of your files. We are not responsible for data loss.</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">7. Third-Party Links</h2>
        <p className="mb-6">
          Our Service may contain links to third-party websites. We are not responsible for their content or practices.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">8. Intellectual Property</h2>
        <p className="mb-6">
          All content, branding, and tools provided on FileQuick remain our intellectual property. You may not resell or redistribute any part of the Service.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">9. No Warranty</h2>
        <p className="mb-6">
          The Service is provided "as is" without warranties of any kind.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">10. Limitation of Liability</h2>
        <p className="mb-6">
          We are not liable for any direct, indirect, incidental, or consequential damages resulting from your use of the Service.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">11. Governing Law</h2>
        <p className="mb-6">
          These Terms are governed by the laws of India.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">12. Changes to Terms</h2>
        <p className="mb-8">
          We may update these Terms from time to time. Continued use of the Service means you accept the changes.
        </p>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-10">
          <p className="italic text-gray-600 dark:text-gray-400">
            If you have any questions or concerns, please contact us at mju646139@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService; 