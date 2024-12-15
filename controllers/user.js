const bcrypt = require("bcrypt");
const saltRounds = 10; // Número de rondas para la generación de sal
const User = require("../models/user");
const jwt = require("../services/jwt");
const fs = require("fs");
const path = require("path");
const cloudinary = require('cloudinary').v2;
const dotenv = require("dotenv");
dotenv.config();


const pruebaUser = (req, res) => {
  return res.status(200).send({
    message: "Mensaje enviado desde: controllers/user.js",
    usuario: req.user,
  });
};

const register = async (req, res) => {
  try {
    // Recoger datos de la petición
    let params = req.body;
    const createdByUser = req.user;

    // Validar campos requeridos
    if (!params.name || !params.email || !params.password || !params.nick) {
      return res.status(400).json({
        status: "error",
        message:
          "Faltan datos por enviar. Asegúrate de proporcionar name, email, password y nick.",
      });
    }

    // Crear objeto de usuarios
    let user_to_save = new User(params);

    // Control de usuarios duplicados
    const existingUsers = await User.find({
      $or: [
        { email: user_to_save.email.toLowerCase() },
        { nick: user_to_save.nick.toLowerCase() },
      ],
    });

    if (existingUsers && existingUsers.length > 0) {
      return res.status(200).json({
        status: "success",
        message: "El usuario ya existe",
      });
    }

    // Generar la sal y cifrar la contraseña
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(params.password, salt);

    // Asignar la contraseña cifrada al usuario
    user_to_save.password = hashedPassword;

    // Guardar usuario en la base de datos
    await user_to_save.save();

    // Devolver resultado exitoso
    return res.status(200).json({
      status: "success",
      message: "Usuario registrado correctamente.",
      user: user_to_save,
      creatorUsername: createdByUser, // usuario que lo creó
    });
  } catch (error) {
    console.error("Error en el registro de usuarios:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor al registrar el usuario.",
    });
  }
};

const login = async (req, res) => {
  // recoger parametros body
  let params = req.body;
  if (!params.email || !params.password) {
    return res.status(400).send({
      status: "error",
      message: "Faltan datos por enviar",
    });
  }

  try {
    // buscar en la bbd si existe
    const user = await User.findOne({ email: params.email });

    if (!user) {
      return res.status(400).send({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    // comprobar su contraseña
    const passwordMatch = await bcrypt.compare(params.password, user.password);

    if (!passwordMatch) {
      return res.status(400).send({
        status: "error",
        message: "Contraseña incorrect",
      });
    }

    // user.password = undefined; oculta constraseña
    // devolver token
    const token = jwt.createToken(user);
    console.log(token);

    // devolver datos del usuario (sin mostrar la contraseña)
    return res.status(200).send({
      status: "success",
      message: "Acción de login exitosa",
      user: {
        id: user._id,
        name: user.name,
        nick: user.nick,
      },
      token,
    });
  } catch (error) {
    console.error("Error en la acción de login:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor al realizar la acción de login.",
    });
  }
};

const profile = async (req, res) => {
  try {
    console.log("Token de autenticación:", req.headers.authorization); // Verifica el token recibido

    const id = req.params.id.trim();
    console.log("ID del usuario:", id);

    const userProfile = await User.findById(id);
    console.log("Perfil del usuario encontrado:", userProfile);

    if (!userProfile) {
      return res.status(404).json({
        status: "error",
        message: "El usuario no existe",
      });
    }

    return res.status(200).json({
      status: "success",
      user: userProfile,
    });
  } catch (error) {
    console.error("Error al buscar el usuario:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor al buscar el usuario.",
    });
  }
};




const list = (req, res) => {
  // Obtiene el número de página de la URL o establece el valor predeterminado en 1 si no se proporciona
  const page = req.params.page || 1;
  let userDatos = req.user;
  console.log("soy yo desde lista");
  console.log(userDatos);

  // Define las opciones de paginación
  const options = {
    page: page,
    limit: 3,
  };

  // Realiza la consulta utilizando las opciones de paginación
  User.paginate({}, options, (err, result) => {
    console.log(result);
    if (err) {
      console.error("Error al obtener la lista de usuarios:", err);
      return res.status(500).json({
        status: "error",
        message: "Error interno del servidor al obtener la lista de usuarios.",
      });
    }

    // Si no hay error, envía los documentos de la página solicitada como respuesta
    res.send({
      items: result.docs,
      totalUsers: result.totalDocs,
      totalPages: result.totalPages,
      LoggedInUser: userDatos,
    });
  });
};

const update = async (req, res) => {
  try {
    // Recoger información del usuario a modificar
    let userIdentity = req.user;
    let userToUpdate = req.body;
    console.log(userIdentity);
    // Eliminar campos sobrantes que no queremos modofiicar ahora
    delete userToUpdate.iat;
    delete userToUpdate.exp;

    delete userToUpdate.image;

    // Verificar si el usuario existe
    const existingUser = await User.findById(userIdentity.id);

    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    // Verificar y cifrar la nueva contraseña si se proporciona
    if (userToUpdate.password) {
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(userToUpdate.password, salt);
      // Asignar la contraseña cifrada al usuario
      userToUpdate.password = hashedPassword;
    }

    // Actualizar usuario en la base de datos
    const updatedUser = await User.findByIdAndUpdate(
      userIdentity.id,
      userToUpdate,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        status: "error",
        message: "Error al actualizar usuario",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Usuario actualizado exitosamente",
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      message: "Hubo un error al actualizar el usuario",
    });
  }
};
//subir imagen
// Subir imagen a Cloudinary
const upload = async (req, res) => {
  // Configuration
  cloudinary.config({
    cloud_name: process.env.cloud_name,
    api_key: process.env.api_key,
    api_secret: process.env.api_secret
  });
  try {
    if (!req.file) {
      return res.status(404).send({
        status: "error",
        message: "La petición no incluye la imagen",
      });
    }

    const extension = req.file.originalname.split(".").pop().toLowerCase();

    if (!["png", "jpg", "jpeg", "gif"].includes(extension)) {
      const filepath = req.file.path;
      try {
        fs.unlinkSync(filepath); // Elimina el archivo local si no es válido
      } catch (error) {
        console.error("Error al eliminar el archivo:", error);
      }

      return res.status(400).json({
        status: "error",
        message: "La extensión del archivo no es válida",
      });
    }

    // Subir la imagen a Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'avatars',
      use_filename: true, 
      unique_filename: false, 
    });

    // Eliminar el archivo local después de subirlo a Cloudinary
    fs.unlinkSync(req.file.path);

    // Actualizar el avatar del usuario en la base de datos con el URL de Cloudinary
    const userUpdate = await User.findByIdAndUpdate(
      req.user.id,
      { image: result.secure_url }, // Guardar la URL de la imagen en Cloudinary
      { new: true }
    );

    if (!userUpdate) {
      return res.status(500).send({
        status: "error",
        message: "Error en la subida de avatar",
      });
    }

    return res.status(200).send({
      status: "success",
      message: "Avatar subido correctamente",
      data: userUpdate,
    });

  } catch (error) {
    console.error("Error en la carga:", error);
    return res.status(500).send({
      status: "error",
      message: "Error interno del servidor",
    });
  }
};

const avatar = (req, res) => {
  const file = req.params.file;

  // Usar la URL de Cloudinary para obtener la imagen
  const imageUrl = `https://res.cloudinary.com/didnj5xfr/image/upload/avatars/${file}`;

  // Comprobar si la URL de la imagen es válida
  fetch(imageUrl)
    .then(response => {
      if (!response.ok) {
        return res.status(404).send({
          status: "error",
          message: "La imagen no existe en Cloudinary",
        });
      }
      return res.status(200).send({
        status: "success",
        message: "Imagen encontrada",
        url: imageUrl,
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: "error",
        message: "Error al obtener la imagen",
      });
    });
};


//Delete Publication/Eliminar publicacion
const delete_user = async (req, res) => {
  try {
    const userId = req.user.id; // ID del usuario logueado
    const targetUserId = req.params.id; // ID del usuario a eliminar (pasado en la URL)

    // Verificar si el usuario logueado tiene permisos para eliminar a otro usuario
    // Esto depende de tu lógica de negocio, por ejemplo, solo administradores pueden eliminar otros usuarios
    if (req.user.role !== 'admin' && userId !== targetUserId) {
      return res.status(403).send({
        status: "error",
        message: "No tienes permiso para eliminar este usuario",
      });
    }

    // Buscar y eliminar el usuario
    const user = await User.findByIdAndDelete(targetUserId);

    // Si no se encuentra el usuario, devolver un error 404
    if (!user) {
      return res.status(404).send({
        status: "error",
        message: "No se ha encontrado el usuario",
      });
    }

    // Devolver respuesta de éxito
    return res.status(200).send({
      status: "success",
      message: "Usuario eliminado",
      user,
    });
  } catch (err) {
    // Manejar errores generales
    return res.status(500).send({
      status: "error",
      message: "Error al eliminar el usuario",
      error: err.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    // Consultar todos los usuarios
    const users = await User.find({});

    // Devolver resultado exitoso
    return res.status(200).json({
      status: "success",
      users,
    });
  } catch (error) {
    console.error("Error al obtener todos los usuarios:", error);
    return res.status(500).json({
      status: "error",
      message: "Error interno del servidor al obtener todos los usuarios.",
    });
  }
};

module.exports = {
  pruebaUser,
  register,
  login,
  profile,
  list,
  update,
  upload,
  avatar,
  delete_user,
  getAllUsers
};
