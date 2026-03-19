

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user?.role) return res.status(403).json({ message: "Forbidden" });

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};

export default authorizeRoles;