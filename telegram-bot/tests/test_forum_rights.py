"""Telegram answers that mean the bot cannot create a forum topic."""

from bot.forum_rights import lacks_forum_admin_rights


def test_missing_topic_rights_is_reported_to_the_creator():
    assert lacks_forum_admin_rights(Exception("Bad Request: not enough rights to manage topics"))
    assert lacks_forum_admin_rights(Exception("Forbidden: bot is not a member of the supergroup chat"))
    assert lacks_forum_admin_rights(Exception("Bad Request: CHAT_ADMIN_REQUIRED"))


def test_other_telegram_failures_stay_in_the_log():
    assert not lacks_forum_admin_rights(Exception("Bad Request: chat not found"))
    assert not lacks_forum_admin_rights(Exception("Bad Request: TOPIC_CLOSED"))
