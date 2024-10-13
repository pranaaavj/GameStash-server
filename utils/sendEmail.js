import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  host: 'smtp.gmail.com',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
  pool: true,
  rateLimit: true,
  maxConnections: 5,
  maxMessages: 100,
});

export const sendEmail = async (email, title, body) => {
  let info = await transporter.sendMail({
    from: 'gameStash@gmail.com GameStash',
    to: email,
    subject: title,
    html: body,
  });
  return info;
};
