import * as usersRepository from "../repositories/users.repository.js";
import { UserNotFoundError } from "../errors/index.js";

export const listUsers = async () => {
  return usersRepository.findAllUsers();
};

// El repository devuelve null si el id es inválido o no existe: el service decide qué error es.
export const getUserById = async (userId) => {
  const user = await usersRepository.findUserById(userId);

  if (!user) {
    throw new UserNotFoundError();
  }

  return user;
};
