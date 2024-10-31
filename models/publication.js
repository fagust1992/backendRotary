const { Schema, model } = require("mongoose");

const PublicationSchema = new Schema({
  user: {
    type: Schema.ObjectId,
    
    ref: "User",  // "User" corresponde a collecion base de datos

  },
  text: {
    type: String,
    required: true,
  },

});

module.exports = model("Publication", PublicationSchema, "publications");

