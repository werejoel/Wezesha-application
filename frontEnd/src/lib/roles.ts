export const normalizeRole = (role: string | undefined | null) => {
  if (!role) return role;
  const normalized = role.toString().trim().toLowerCase().replace(/\s+/g, "_");

  if (normalized === "program_manager" || normalized === "programmanager") {
    return "program_manager";
  }
  if (normalized === "program_leadership" || normalized === "programleadership") {
    return "program_leadership";
  }
  if (
    normalized === "program_manager_out_of_school" ||
    normalized === "programmanageroutofschool"
  ) {
    return "program_manager_out_of_school";
  }
  if (
    normalized === "program_manager_in_school" ||
    normalized === "programmanagerinschool"
  ) {
    return "program_manager_in_school";
  }
  if (
    normalized === "program_supervisor" ||
    normalized === "programsupervisor"
  ) {
    return "program_supervisor";
  }
  if (normalized === "ybf" || normalized === "youth_business_fellow") {
    return "ybf";
  }
  if (normalized === "instructor") return "instructor";
  // Enumerator was retired; legacy accounts retain instructor access.
  if (normalized === "enumerator") return "instructor";
  if (normalized === "admin" || normalized === "administrator") return "admin";
  return normalized;
};

export const roleDisplayName = (role: string | undefined | null) => {
  switch (role) {
    case "program_leadership":
      return "Program Leadership";
    case "program_manager_out_of_school":
      return "Program Manager Out of School";
    case "program_manager_in_school":
      return "Program Manager In School";
    case "program_supervisor":
      return "Program Supervisor";
    case "program_manager":
      return "Program Manager";
    case "ybf":
      return "YBF";
    case "instructor":
      return "Instructor";
    case "admin":
      return "Admin";
    default:
      return role || "User";
  }
};
