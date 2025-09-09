import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms and Conditions - Evently',
  description: 'Terms and Conditions for Evently by JICATE Solutions Private Limited',
}

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms and Conditions</h1>
          
          <div className="prose prose-gray max-w-none space-y-6 text-gray-700 leading-relaxed">
            <p>
              For the purpose of these Terms and Conditions, The term "we", "us", "our" used anywhere on this page shall mean <strong>JICATE SOLUTIONS PRIVATE LIMITED</strong>, whose registered/operational office is NH-544, Salem to, Nagapattinam - Coimbatore - Gundlupet Highway, Natarajapuram, Komarapalayam Namakkal TAMIL NADU 638183. "you", "your", "user", "visitor" shall mean any natural or legal person who is visiting our website and/or agreed to purchase from us.
            </p>

            <p>
              Your use of the website and/or purchase from us are governed by following Terms and Conditions:
            </p>

            <ul className="list-disc pl-6 space-y-3">
              <li>The content of the pages of this website is subject to change without notice.</li>
              
              <li>Neither we nor any third parties provide any warranty or guarantee as to the accuracy, timeliness, performance, completeness or suitability of the information and materials found or offered on this website for any particular purpose. You acknowledge that such information and materials may contain inaccuracies or errors and we expressly exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.</li>
              
              <li>Your use of any information or materials on our website and/or product pages is entirely at your own risk, for which we shall not be liable. It shall be your own responsibility to ensure that any products, services or information available through our website and/or product pages meet your specific requirements.</li>
              
              <li>Our website contains material which is owned by or licensed to us. This material includes, but are not limited to, the design, layout, look, appearance and graphics. Reproduction is prohibited other than in accordance with the copyright notice, which forms part of these terms and conditions.</li>
              
              <li>All trademarks reproduced in our website which are not the property of, or licensed to, the operator are acknowledged on the website.</li>
              
              <li>Unauthorized use of information provided by us shall give rise to a claim for damages and/or be a criminal offense.</li>
              
              <li>From time to time our website may also include links to other websites. These links are provided for your convenience to provide further information.</li>
              
              <li>You may not create a link to our website from another website or document without JICATE SOLUTIONS PRIVATE LIMITED's prior written consent.</li>
              
              <li>Any dispute arising out of use of our website and/or purchase with us and/or any engagement with us is subject to the laws of India.</li>
              
              <li>We, shall be under no liability whatsoever in respect of any loss or damage arising directly or indirectly out of the decline of authorization for any Transaction, on Account of the Cardholder having exceeded the preset limit mutually agreed by us with our acquiring bank from time to time</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Cancellation and Refund</h2>
            
            <p>
              <strong>JICATE SOLUTIONS PRIVATE LIMITED</strong> believes in helping its customers as far as possible, and has therefore a liberal cancellation policy. Under this policy:
            </p>

            <ul className="list-disc pl-6 space-y-3">
              <li>Cancellations will be considered only if the request is made within 1-2 days of placing the order. However, the cancellation request may not be entertained if the orders have been communicated to the vendors/merchants and they have initiated the process of shipping them.</li>
              
              <li>JICATE SOLUTIONS PRIVATE LIMITED does not accept cancellation requests for perishable items like flowers, eatables etc. However, refund/replacement can be made if the customer establishes that the quality of product delivered is not good.</li>
              
              <li>In case of receipt of damaged or defective items please report the same to our Customer Service team. The request will, however, be entertained once the merchant has checked and determined the same at his own end. This should be reported within 1-2 days of receipt of the products.</li>
              
              <li>In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within 1-2 days of receiving the product. The Customer Service Team after looking into your complaint will take an appropriate decision.</li>
              
              <li>In case of complaints regarding products that come with a warranty from manufacturers, please refer the issue to them.</li>
              
              <li>In case of any Refunds approved by the JICATE SOLUTIONS PRIVATE LIMITED, it'll take 1-2 days for the refund to be processed to the end customer.</li>
            </ul>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Last updated: {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
