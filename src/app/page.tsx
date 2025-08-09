"use client";

import { signOut, useSession } from "next-auth/react";
import SpellingManager from "../components/SpellingManager";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Shepherd Speller
                </h1>
                <p className="text-gray-600">
                  Hello, {session?.user?.name || "User"}!
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-8">
          {session?.user?.email ? (
            <SpellingManager />
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                Please sign in to access the spelling manager.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
