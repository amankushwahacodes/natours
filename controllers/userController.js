const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerfactory');
const multer = require('multer');
const sharp = require('sharp');
const streamifier = require('streamifier');
const cloudinary = require('../utils/cloudinary');

// const multerStorage = multer.diskStorage({
//     destination : (req,file,cb) => {
//         cb(null,'public/img/users')
//     },
//     filename : (req,file,cb) =>{
//         const ext = file.mimetype.split('/')[1]
//         cb(null,`user-${req.user.id}-${Date.now()}.${ext}`)
//     }
// })

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image ! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

exports.uploadUserPhotoToCloudinary = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  const streamUpload = () => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'natours/users',
          public_id: `user-${req.user.id}`,
          overwrite: true,
        },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        },
      );

      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });
  };

  const result = await streamUpload();
  req.body.photo = result.secure_url;

  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // Create error if user post password data
  if (req.body.pwd || req.body.pwdCnfrm) {
    return next(
      new AppError(
        'This route is not for pwd upodates . Please use /updatePassword ',
        404,
      ),
    );
  }

  // Update User document
  const filterBody = filterObj(req.body, 'name', 'email');
  if (req.body.photo) filterBody.photo = req.body.photo;

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filterBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined',
  });
};
exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
