const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const exphbs = require("hbs"); // Require Handlebars
const nodemailer = require("nodemailer");
const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect('mongodb://localhost:27017/mydb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

var db = mongoose.connection;

db.on('error', () => console.log("Error in Connecting to Database"));
db.once('open', () => console.log("Connected to Database"))

// Function to generate a random reset code
function generateResetCode() {
    // Generate a random 6-digit code
    return Math.floor(100000 + Math.random() * 900000);
}

// Set Handlebars as the view engine
app.set('view engine', 'html');

app.post("/sign_up", async (req, res) => {
    try {
        var fullname = req.body.fullname;
        var email = req.body.email;
        var username = req.body.username;
        var password = req.body.password;

        // Check if the username already exists in the database
        const existingUser = await db.collection('users').findOne({ username });

        if (existingUser) {
            // Username already exists, show an alert
            return res.send("<script>alert('Username already exists. Please choose a different username.'); window.location.href = '/signup.html';</script>");
        }

        // Generate a new reset code for the user
        const resetCode = generateResetCode();

        // Save the user details and reset code to the database
        await db.collection('users').insertOne({
            fullname,
            email,
            username,
            password,
            resetCode // Save the reset code
        });

        // Set up Nodemailer transporter
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: '-----------------------',
                pass: '-----------------------'
            }
        });

        // Define email options
        let mailOptions = {
            from: '----------------------------',
            to: email, // Use the email provided during sign up
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${resetCode}`
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error:", error);
                return res.send("<script>alert('Failed to send reset code. Please try again later.'); window.location.href = '/signup.html';</script>");
            }
            console.log('Reset code sent:', info.response);
            return res.redirect('emailverification.html');
        });
    } catch (error) {
        console.error("Error:", error);
        return res.send("<script>alert('Internal server error. Please try again later.'); window.location.href = '/signup.html';</script>");
    }
});


app.post("/submit_complaint", async (req, res) => {
    try {
        var fullName = req.body.fullname;
        var email = req.body.email;
        var telephone = req.body.telephone;
        var complaintType = req.body.complaintType;
        var complaintDetails = req.body.complaintDetails;

        // Save the complaint details to the "complaints" collection in the database
        await db.collection('complaints').insertOne({
            fullName,
            email,
            telephone,
            complaintType,
            complaintDetails,
            createdAt: new Date() // Add a timestamp for when the complaint was filed
        });

       // Set up Nodemailer transporter
       let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: '------------------------',
            pass: '------------------------'
        }
    });

        // Define email options
        let mailOptions = {
            from: '--------------------', // Update with your email
            to: '----------------------', // Update with admin's email
            subject: 'New Complaint Received',
            html: `
                <p>Hello Admin,</p>
                <p>A new complaint has been filed:</p>
                <ul>
                    <li><strong>Name:</strong> ${fullName}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Telephone:</strong> ${telephone || 'Not provided'}</li>
                    <li><strong>Complaint Type:</strong> ${complaintType}</li>
                    <li><strong>Complaint Details:</strong> ${complaintDetails}</li>
                </ul>
            `
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
                return res.send("<script>alert('Failed to submit complaint. Please try again later.'); window.location.href = '/complaint.html';</script>");
            }
            console.log('Email sent:', info.response);
            return res.redirect('/afterlogin.html'); // Redirect to a confirmation page
        });
    } catch (error) {
        console.error("Error submitting complaint:", error);
        return res.send("<script>alert('Internal server error. Please try again later.'); window.location.href = '/complaint.html';</script>");
    }
});


app.post("/verify_code", async (req, res) => {
    try {
        const { username, resetCode } = req.body;

        const user = await db.collection('users').findOne({ username });

        if (!user) {
            // User not found
            return res.send("<script>alert('User not found.'); window.location.href = '/emailverification.html';</script>");
        }

        // Check if the user has reached the maximum number of attempts
        if (user.attempts >= 3) {
            // Delete user data from the database
            await db.collection('users').deleteOne({ username });
            // Redirect to signup page
            return res.redirect('/signup.html');
        }

        // Compare the provided reset code with the reset code from the database
        if (parseInt(user.resetCode) === parseInt(resetCode)) { // Compare reset codes after parsing to integers
            // Reset codes match, redirect to home page or send success response
            return res.redirect('landingpage.html'); // Adjust the redirection URL as needed
        } else {
            // Increment the attempts count
            await db.collection('users').updateOne({ username }, { $inc: { attempts: 1 } });
            // Reset codes don't match
            return res.send("<script>alert('Incorrect reset code. Attempts remaining: " + (2 - user.attempts) + "'); window.location.href = '/emailverification.html';</script>");
        }
    } catch (error) {
        console.error("Error verifying code:", error);
        return res.send("<script>alert('Failed to verify. Please try again later.'); window.location.href = '/emailverification.html';</script>");
    }
});


app.post('/login', async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ username: req.body.username });
        
        if (!user) {
            // User not found
            return res.send("<script>alert('User not found.'); window.location.href = '/login.html';</script>");
        }

        // Compare the provided password with the password from the database
        const passwordMatch = user.password === req.body.password;

        if (passwordMatch) {
            // Passwords match, redirect to home page or send success response
            return res.redirect('afterlogin.html'); // Adjust the redirection URL as needed
        } else {
            // Passwords don't match
            return res.send("<script>alert('Incorrect password.'); window.location.href = '/login.html';</script>");
        }
    } catch (error) {
        // Handle any errors
        console.error("Error:", error);
        return res.send("<script>alert('Internal server error. Please try again later.'); window.location.href = '/login.html';</script>");
    }
});


app.post("/send_reset_code", async (req, res) => {
    try {
        const user = await db.collection('users').findOne({ username: req.body.username });
        
        if (!user) {
            // User not found
            return res.send("<script>alert('User not found.'); window.location.href = '/forgot password.html';</script>");
        }

        // Generate a reset code and save it to the user's record in the database
        const resetCode = generateResetCode(); // Implement this function according to your requirements
        await db.collection('users').updateOne({ username: req.body.username }, { $set: { resetCode } });

        // Set up Nodemailer transporter
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: '-------------------',
                pass: '-------------------'
            }
        });

        // Define email options
        let mailOptions = {
            from: '-------------------',
            to: user.email, // Use the email fetched from the user object
            subject: 'Password Reset Code',
            text: `Your password reset code is: ${resetCode}`
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
                return res.send("<script>alert('Failed to send reset code.'); window.location.href = '/forgot password.html';</script>");
            }
            console.log('Reset code sent:', info.response);
            return res.send("<script>alert('Reset code sent successfully.'); window.location.href = '/forgot password.html';</script>");
        });
    } catch (error) {
        console.error("Error sending reset code:", error);
        return res.send("<script>alert('Internal server error.'); window.location.href = '/forgot password.html';</script>");
    }
});



app.post("/reset_password", async (req, res) => {
    try {
        const { username_hidden, resetCode, new_password } = req.body;

        console.log("Request received - Username:", username_hidden); // Log the username received from the request

        // Find the user in the database by username_hidden instead of req.body.username
        const user = await db.collection('users').findOne({ username: username_hidden });

        if (!user) {
            // If the user doesn't exist, return an error response
            return res.status(404).send("User not found");
        }

        console.log("User found:", user); // Log the user object retrieved from the database

        // Check if the provided code matches the reset code in the database for that user
        if (parseInt(user.resetCode) !== parseInt(resetCode)) {
            // If the codes don't match, return an error response
            return res.status(401).send("Incorrect reset code");
        }

        // Update the user's password in the database
        await db.collection('users').updateOne({ username: username_hidden }, { $set: { password: new_password } });

        // Remove the reset code from the user's record in the database
        await db.collection('users').updateOne({ username: username_hidden }, { $unset: { resetCode: "" } });

        // Redirect the user to the login page or any other appropriate page
        return res.send("<script>alert('Password reset successfully. You can now login with your new password.'); window.location.href = '/login.html';</script>");
    } catch (error) {
        console.error("Error resetting password:", error);
        return res.status(500).send("Internal server error");
    }
});




app.get("/", (req, res) => {
    res.set({
        "Allow-access-Allow-Origin": '*'
    })
    return res.redirect('landingpage.html');
});

app.listen(3000, () => {
    console.log('Listening on PORT 3000');
});
// Define a route handler to serve the reset_password.html file
app.get("/reset_password.html", (req, res) => {
    res.sendFile(__dirname + "/reset_password.html"); // Assuming reset_password.html is in the root directory
});
