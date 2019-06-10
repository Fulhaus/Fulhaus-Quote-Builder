const nodemailer = require("nodemailer");
const pdfmaker = require("./quotepdfmaker.js");
const key = require("./mailbot-key.json");

const SENDER_ADDRESS = 'info@fulhaus.com';

// async..await is not allowed in global scope, must use a wrapper
async function main(sendTo){

  // create reusable transporter object using the default SMTP transport
	let transporter = nodemailer.createTransport({
		service: 'Gmail',
		auth: {
			type: 'OAuth2',
			user: SENDER_ADDRESS, // generated ethereal user
			serviceClient: key.client_id,
			privateKey: key.private_key
		}
	});

  // send mail with defined transport object
	var pdfpath = await pdfmaker.getQuoteStream('recCQ6b4kMwQElcLr');
	console.log(pdfpath);
	let info = await transporter.sendMail({
		from: '"Fulhaus Auto-Quote" <info@fulhaus.com>', // sender address
		to: "kalin@fulhaus.com", // list of receivers
		//cc: "info@fulhaus.com",
    	subject: "heres your god damn quote", // Subject line
    	text: "The provided quote is an estimate. Taxes, shipping and handling, and industry discounts may all affect the final price. Please contact our team for more info!", // plain text body
		attachments: [
			{
				filename: 'quote.pdf',
				path: __dirname+pdfpath
			}
		]
	});

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}

main().catch(console.error);