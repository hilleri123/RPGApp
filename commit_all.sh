#!/bin/bash

# Переход в каждый подмодуль и коммит изменений
for dir in RPG* ; do
    echo "Коммит изменений в $dir"
    cd $dir
    git add .
    git commit -m "Описание изменений"
    echo "Отправка изменений в удалённый репозиторий"
    # git push origin HEAD:master
    # Проверяем текущую ветку
    branch=$(git symbolic-ref --short -q HEAD)
    if [ -z "$branch" ]; then  # detached HEAD
        branch="master"        # или main, если так у тебя
        echo "detached HEAD — пушим на $branch"
        git push origin HEAD:refs/heads/$branch
    else
        git push
    fi
    cd ..
done

# Коммит изменений в родительском репозитории
echo "Коммит изменений в родительском репозитории"
git add .
git commit -m "Описание изменений"

# Отправка изменений в удалённый репозиторий
echo "Отправка изменений в удалённый репозиторий"
git push origin master

