const emailModel = require("../../models/email");
const { isValidEmail } = require("../../utils/func");



// create email.....



const createEmail=async(req,res,next)=>{
     try {
        const email = req.body.email;
     email = String(email).replace(/  +/g, "").trim();
			const emailLengthOk = email.length < 40;
			if (emailLengthOk) {
				if (isValidEmail(email)) {
					  const saveEmail = await emailModel.save();
                      if(saveEmail){
                          return res.status(201).json({
                            message: "Successfully saved email....",
                            data: saveEmail,
                          })
                      }else{
                        return res.status(400).json({
                            message: "Couldn't save the email"
                        })
                      }
				} else {
					issue.email = "Please enter valid email address!";
				}
			} else {
				issue.email = "Email length is too long!";
			}
		
     } catch (error) {
        next(error);
     }

};

// Get all Emails....


const getAllEmails = async(req,res,next)=>{
          const limit = req.query.limit;
          const skip = req.query.skip;
          const findEmails = await emailModel.find().sort({createdAt: 1}).limit(`${limit}`).skip(`${skip}`);
          if(findEmails){
              return res.status(200).json({
                data: findEmails
              })
          }else{
            return res.status(404).json({
                message: "404! Not Found.."
            })
          }
}


module.exports = {createEmail, getAllEmails};