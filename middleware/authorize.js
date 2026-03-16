// const authorizeRoles = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({
//         message: "Access Denied"
//       });
//     }
//     next();
//   };
// };

// export default authorizeRoles;

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user?.role) return res.status(403).json({ message: "Forbidden" });

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};

export default authorizeRoles;