const fs = require("fs");
const path = require('path');
const Publication = require("../models/publication");
const cloudinary = require("cloudinary").v2;

// acciones de prueba
const pruebaPublication = (req, res) => {
  return res.status(200).send({
    message: "mensaje enviado desde: controllers/publication.js",
  });
};

// guardar publicacion
const save = async (req, res) => {
  try {
    // recoger datos del body
    const params = req.body;

    // si no llegan datos arrogar error
    if (!params.text) {
      return res.status(400).send({
        status: "error",
        message: "debes enviar el texto de la publicacion",
      });
    }

    // crear y rellenar objeto del modelo
    let newPublication = new Publication(params);
    newPublication.user = req.user.id;
    console.log(newPublication);

    // guardar objeto en bbd
    const publicationStored = await newPublication.save();

    return res.status(200).send({
      status: "success",
      message: "Publicacion guardada",
      publication: publicationStored,
    });
  } catch (error) {
    return res.status(500).send({
      status: "error",
      message: "no se ha guardado la publicacion",
      error: error.message,
    });
  }
};

// Sacar Publicacion

// Obtener detalles de una publicación
const Detail = async (req, res) => {
  try {
    // Sacar id de la publicación de la URL
    const publicationId = req.params.id;
    console.log(publicationId);

    // Buscar la publicación por ID
    const publicationStored = await Publication.findById(publicationId);

    // Si no se encuentra la publicación, devolver un error 404
    if (!publicationStored) {
      return res.status(404).send({
        status: "error",
        message: "No existe la publicación",
      });
    }

    // Devolver la publicación encontrada
    return res.status(200).send({
      status: "success",
      message: "Mostrar publicación",
      publication: publicationStored,
    });
  } catch (err) {
    // Manejar errores generales
    return res.status(500).send({
      status: "error",
      message: "Error al obtener la publicación",
      error: err.message,
    });
  }
};

//Delete Publication/Eliminar publicacion
const remove = async (req, res) => {
  try {
    const publicationId = req.params.id;

    // Buscar y luego eliminar la publicación
    const publication = await Publication.findOneAndDelete({
      user: req.user.id,
      _id: publicationId,
    });
    console.log(req.user);
    // Si no se encuentra la publicación, devolver un error 404
    if (!publication) {
      return res.status(404).send({
        status: "error",
        message: "No se ha encontrado esta publicación ",
      });
    }

    // Devolver respuesta de éxito
    return res.status(200).send({
      status: "success",
      message: "Publicación eliminada",
      publication: publicationId,
    });
  } catch (err) {
    // Manejar errores generales
    return res.status(500).send({
      status: "error",
      message: "No se ha eliminado ninguna publicación",
      error: err.message,
    });
  }
};

// Listar publicaciones de un usuario
const user = async (req, res) => {
  try {
    // Sacar el id del usuario
    const userId = req.params.id;

    // Obtener todas las publicaciones del usuario
    const publications = await Publication.find({ user: userId })
      .sort("-created_at") // Ordenar por fecha de creación descendente
      .exec();

    // Devolver respuesta
    return res.status(200).send({
      status: "success",
      message: "Publicaciones del perfil de Usuario",
      user: req.user,
      publications,
      totalPublications: publications.length, // Total de publicaciones
      totalPages: 1, // Solo una página porque no hay paginación
      currentPage: 1, // Página actual
    });
  } catch (err) {
    // Manejar errores generales
    return res.status(500).send({
      status: "error",
      message: "Error al obtener las publicaciones",
      error: err.message,
    });
  }
};

// subir imagen
const upload = async (req, res) => {
  try {
    const publicationId = req.params.id;
    console.log("Publication ID:", publicationId);

    if (!req.file) {
      return res.status(404).send({
        status: "error",
        message: "Petición no incluye la imagen",
      });
    }

    const image = req.file.originalname;
    console.log(image);

    // Extraemos la extensión del archivo
    const imageSplit = image.split(".");
    const extension = imageSplit[imageSplit.length - 1];

    // Comprobar que la extensión del archivo es válida
    if (!["png", "jpg", "jpeg", "gif"].includes(extension)) {
      const filePath = req.file.path;
      fs.unlinkSync(filePath); // Eliminar el archivo local si la extensión es inválida

      return res.status(400).send({
        status: "error",
        message: "Extensión del fichero inválida",
      });
    }

    // Configuración de Cloudinary
    cloudinary.config({
      cloud_name: process.env.cloud_name,
      api_key: process.env.api_key,
      api_secret: process.env.api_secret,
    });

    // Subir la imagen a Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "publications", // Usa una carpeta específica para publicaciones
      use_filename: true,
      unique_filename: false,
    });

    // Eliminar el archivo local después de subirlo
    fs.unlinkSync(req.file.path);

    // Actualizar la publicación con la URL de la imagen
    const publicationUpdated = await Publication.findOneAndUpdate(
      { user: req.user.id, _id: publicationId },
      { image: result.secure_url }, // Cambiar "file" por "image"
      { new: true }
    );

    if (!publicationUpdated) {
      return res.status(500).send({
        status: "error",
        message: "Error en la subida de la publicación",
      });
    }

    return res.status(200).send({
      status: "success",
      publication: publicationUpdated,
      file: result.secure_url, // Retornamos la URL de la imagen subida
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send({
      status: "error",
      message: "Error en la solicitud",
      error: error.message,
    });
  }
};


const media = (req, res) => {
  const file = req.params.file;

  // Construir la URL de la imagen en Cloudinary
  const imageUrl = `https://res.cloudinary.com/${process.env.cloud_name}/image/upload/publications/${file}`;

  // Verificar que la imagen existe en Cloudinary
  fetch(imageUrl)
    .then(response => {
      if (!response.ok) {
        return res.status(404).send({
          status: "error",
          message: "La imagen no existe en Cloudinary",
        });
      }

      // Responder con la URL de la imagen
      return res.status(200).send({
        status: "success",
        message: "Imagen encontrada",
        url: imageUrl,
      });
    })
    .catch(err => {
      console.error("Error al obtener la imagen:", err);
      return res.status(500).send({
        status: "error",
        message: "Error al obtener la imagen",
      });
    });
};


const getAllPublications = async (req, res) => {
  try {
    // Obtén todas las publicaciones sin paginación
    const publications = await Publication.find().sort("-createdAt");

    return res.status(200).send({
      status: "success",
      message: "Listado de todas las publicaciones",
      publications,
      totalPublications: publications.length, // Contar las publicaciones
    });
  } catch (err) {
    console.error("Error en getAllPublications:", err.message);
    return res.status(500).send({
      status: "error",
      message: "Error al obtener las publicaciones",
      error: err.message,
    });
  }
};



const updatePublication = async (req, res) => {
  try {
    // Recoger información de la publicación a modificar
    const publicationId = req.params.id;
    const userId = req.user.id; // Asumiendo que req.user contiene la información del usuario autenticado
    const publicationToUpdate = req.body;


    
    // Verificar si la publicación existe y pertenece al usuario autenticado
    const existingPublication = await Publication.findOne({
      _id: publicationId,  
      
      user: userId,
    });

    if (!existingPublication) {
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada o no pertenece al usuario",
      });
    }

    // Actualizar la publicación en la base de datos
    const updatedPublication = await Publication.findByIdAndUpdate(
      publicationId,
      publicationToUpdate,
      { new: true }
    );

    if (!updatedPublication) {
      return res.status(500).json({
        status: "error",
        message: "Error al actualizar la publicación",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Publicación actualizada exitosamente",
      publication: updatedPublication,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      message: "Hubo un error al actualizar la publicación",
    });
  }
};


module.exports = {
  pruebaPublication,
  save,
  Detail,
  remove,
  user,
  upload,
  media,
  getAllPublications,
  updatePublication
};
//tengo que  subir 