// src/FriendsContent.tsx

import React from 'react';
import { toast } from 'react-toastify';

interface FriendsContentProps {
  username: string;
  userId: number | null;
  friends: Friend[];
  fetchFriends: () => void;
}

interface Friend {
  username: string;
}

const FriendsContent: React.FC<FriendsContentProps> = ({ userId, friends }) => {
  // Function to copy the referral link
  const handleInviteClick = () => {
    const referralLink = `https://t.me/cryptocollect_bot?start=${userId}`;
    navigator.clipboard
      .writeText(referralLink)
      .then(() => {
        toast.success('Реферальная ссылка скопирована в буфер обмена!');
      })
      .catch(() => {
        toast.error(
          'Не удалось скопировать ссылку. Пожалуйста, скопируйте ее вручную: ' + referralLink
        );
      });
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Убрали блок с именем пользователя */}

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-4 mt-4">
        {/* Description Block */}
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h2 className="text-xl text-yellow-400 mb-2">
            Получайте монеты за каждого приглашенного друга в нашу игру.
          </h2>
          <ul className="list-disc list-inside text-gray-300">
            <li>
              После приглашения пользователя вы и ваш друг получите по{' '}
              <span className="text-yellow-400 font-bold">20000 монет</span>, что будет хорошим
              стартом для вас.
            </li>
            <li>
              За каждого последующего пользователя, которого вы пригласите, вы будете получать на{' '}
              <span className="text-yellow-400 font-bold">15000 монет</span> больше.
            </li>
          </ul>
        </div>

        {/* Invited Friends List */}
        <h3 className="text-lg text-gray-300 mb-2">Приглашенные друзья</h3>
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          {friends && friends.length > 0 ? (
            <ul>
              {friends.map((friend, index) => (
                <li key={index} className="text-gray-300 mb-2">
                  {friend.username}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">У вас пока нет приглашенных друзей.</p>
          )}
        </div>
      </div>

      {/* "Invite Friends" Button */}
      <div className="px-4 pb-4" style={{ marginTop: 'auto' }}>
        <button
          onClick={handleInviteClick}
          className="w-full py-3 bg-yellow-500 text-black rounded-lg font-bold hover:bg-yellow-600"
          style={{ marginBottom: '100px' }} // Подняли кнопку на 100 пикселей
        >
          Пригласить друзей
        </button>
      </div>
    </div>
  );
};

export default FriendsContent;
