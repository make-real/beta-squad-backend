const {Schema,model} = require("mongoose");

const emailSchema = new Schema({
    email:{
        type: String,
        required: true
    }
},{timestamps: true});


const emailModel = model("earlyUserEmail", emailSchema);

module.exports = emailModel;