import connectDB from './mongodb'
import User from '../models/User'

export async function createUser(userData: {
  email: string
  name: string
  words: string[]
  sounds: string[]
  spelling: string[]
}) {
  await connectDB()

  const user = new User(userData)
  return await user.save()
}

export async function getUserByEmail(email: string) {
  await connectDB()
  return await User.findOne({ email: email.toLowerCase() })
}

export async function getUserSpellingData(userId: string) {
  await connectDB()
  return await User.findById(userId, { words: 1, sounds: 1, spelling: 1 })
}

export async function updateUserSpellingData(
  userId: string,
  updateData: {
    words?: string[]
    sounds?: string[]
    spelling?: string[]
  }
) {
  await connectDB()

  const updateFields: {
    words?: string[]
    sounds?: string[]
    spelling?: string[]
  } = {}
  if (updateData.words !== undefined) updateFields.words = updateData.words
  if (updateData.sounds !== undefined) updateFields.sounds = updateData.sounds
  if (updateData.spelling !== undefined) updateFields.spelling = updateData.spelling

  return await User.findByIdAndUpdate(userId, { $set: updateFields }, { new: true, runValidators: true })
}
