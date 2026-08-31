import React from 'react';
import { usePageMeta } from '../lib/seo';

const PrivacyPolicy = () => {
  usePageMeta({ title: 'Privacy Policy', description: 'How FileQuick handles your data — most tools run entirely in your browser and never upload your files.' });
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
      <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-8">Privacy Policy</h1>
      
      <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
        <p className="mb-6">
          At FileQuick, we respect your privacy and are committed to protecting your personal data.
          This Privacy Policy explains how we collect, use, and safeguard your information when you use our service.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">1. Information We Collect</h2>
        <p className="mb-6">
          <strong>Usage Data:</strong> We may collect anonymous usage data such as browser type, device information, and the pages of our Service that you visit.
        </p>
        <p className="mb-6">
          <strong>Your files:</strong> Most FileQuick tools run entirely inside your browser — your files are never sent to us.
          A few tools (Word/PowerPoint/Excel to and from PDF, Unlock, Protect, Compress) do send the file to our conversion
          server; there it is processed in a temporary folder and deleted immediately after the result is returned.
          We never store, read, or share your documents.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">2. How We Use Your Information</h2>
        <ul className="list-disc ml-6 mb-6">
          <li className="mb-2">To provide and maintain our Service</li>
          <li className="mb-2">To improve and optimize our Service</li>
          <li className="mb-2">To detect, prevent, and address technical issues</li>
          <li className="mb-2">To monitor the usage of our Service</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">3. Data Security</h2>
        <p className="mb-6">
          The security of your data is important to us. All processing of your files happens locally in your browser when possible.
          When server processing is required, the file is deleted immediately after the conversion — nothing is retained.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">4. Cookies</h2>
        <p className="mb-6">
          We use cookies and similar tracking technologies to track activity on our Service and hold certain information. 
          Cookies are files with a small amount of data which may include an anonymous unique identifier.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">5. Analytics</h2>
        <p className="mb-6">
          We may use third-party Service Providers to monitor and analyze the use of our Service. These services may collect 
          information sent by your browser as part of a web page request, including your IP address or other identifiers.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">6. Third-Party Services</h2>
        <p className="mb-6">
          Our Service may contain links to other websites or services that are not operated by us. If you click on a third-party link, 
          you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">7. Children's Privacy</h2>
        <p className="mb-6">
          Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable 
          information from anyone under the age of 13.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">8. Changes to This Privacy Policy</h2>
        <p className="mb-6">
          We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new 
          Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mt-8 mb-4">9. Contact Us</h2>
        <p className="mb-8">
          If you have any questions about this Privacy Policy, please contact us at mju646139@gmail.com
        </p>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-10">
          <p className="italic text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 