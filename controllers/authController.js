const { promisify } = require('util')
const User = require('./../models/userModel')
const catchAsync = require('./../utils/catchAsync')
const jwt = require('jsonwebtoken')
const AppError = require('./../utils/appError')
const Email = require('./../utils/email')
const crypto = require('crypto')


const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    })
}

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id)
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true
    }
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
    res.cookie('jwt', token, cookieOptions)

    user.pwd = undefined
    res.status(statusCode).json({
        status: 'success', token,
        data: {
            user: user
        }
    })
}

exports.signup = catchAsync(async (req, res, next) => {
    // const newUser = await User.create(req.body); Can be manipulated by Users 
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        pwd: req.body.pwd,
        pwdCnfrm: req.body.pwdCnfrm,
        role: req.body.role
    })
    const url = `${req.protocol}://${req.get('host')}/me`
    // console.log(url);
    // await new Email(newUser,url).sendWelcome()
    createSendToken(newUser, 201, res);

})
const bcrypt = require('bcryptjs')

exports.login = catchAsync(async (req, res, next) => {

    const { email, pwd } = req.body;
    // console.log(email, pwd);
    // check email and pwd exist 
    if (!email || !pwd) {
        return next(new AppError('Please provide email and password !', 400))
    }
    // check user exists and pwd is correct 
    const user = await User.findOne({ email }).select('+pwd');
    // console.log(user);


    if (!user || !(await user.correctPassword(pwd, user.pwd))) return next(new AppError("Incorrect email or pwd", 401))


    // if everything is correct send token to client
    createSendToken(user, 200, res);

})

exports.logout = (req,res) =>{
    // console.log("hrllo");
    res.cookie('jwt','loggedout',{
        expires : new Date(Date.now() + 10 * 1000),
        httpOnly : true
    })
    res.status(200).json({
        status : 'success',     
    })
}

exports.protect = catchAsync(async (req, res, next) => {
    let token;

    // Get token and check if its there

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies.jwt) {
        token = req.cookies.jwt
    }

    if (!token) {
        return next(new AppError('You are not logged in ! Please log in first to get access', 401))
    }

    // verification token

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)
    // console.log(decoded);

    // check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(new AppError('The user belonging to this token does not longer exist .', 401))
    }


    // check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password ! Please log in again ', 401))
    }
    // Grant access
    req.user = currentUser;
    res.locals.user = currentUser
    // console.log(currentUser);

    next();
})

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You dont have permission to perform this action', 402))
        }
        next();
    }
}

exports.forgotPassword = catchAsync(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email })
    if (!user) return next(new AppError('There is no user with email address', 404))



    const resetToken = user.createPasswordResetToken()
    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`

    try {
        await new Email(user,resetURL).sendPasswordReset()


        res.status(200).json({
            status: 'success',
            message: "Token set to email"
        })
    }
    catch (err) {
        user.pwdResetToken = undefined;
        user.pwdResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('There was error sending email . Try again later', 500))

    }

})

exports.resetPassword = catchAsync(async (req, res, next) => {
    // get user based on token
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({ pwdResetToken: hashedToken, pwdResetExpires: { $gt: Date.now() } })
    // If token has not expiredd and there is user  ,set new password
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400))
    }

    user.pwd = req.body.pwd;
    user.pwdCnfrm = req.body.pwdCnfrm;
    user.pwdResetToken = undefined;
    user.pwdResetExpires = undefined;
    await user.save();



    // Update change password property for the user 
    // Log the user in , send jwt 

    createSendToken(user, 200, res);

})


exports.updatePassword = catchAsync(async (req, res, next) => {
    // 1) Get user from collection
    const user = await User.findById(req.user.id).select('+pwd');

    if (!user) {
        return next(new AppError('User not found.', 404));
      }


    // 2) Check if POSTed current password is correct
    // console.log(req.body.pwdCurrent);
    if (!(await user.correctPassword(req.body.pwdCurrent, user.pwd))) {

        return next(new AppError('Your current password is wrong.', 401));
    }

    // 3) If so, update password
    user.pwd = req.body.pwd;
    user.pwdCnfrm = req.body.pwdCnfrm;
    await user.save();
    // User.findByIdAndUpdate will NOT work as intended!

    // 4) Log user in, send JWT
    createSendToken(user, 200, res);
});

// Only for rendered pages
exports.isLoggedIn = async (req, res, next) => {
    if (req.cookies.jwt) {

        try {
            // verify token
            const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET)

            // check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next()
            }

            // check if user changed password after the token was issued
            if (currentUser.changedPasswordAfter(decoded.iat)) {
                return next()
            }
            // there is a logged in user
            res.locals.user = currentUser
            return next();
        }
        catch(err){
            return next();
        }  
    }
    next();
}
