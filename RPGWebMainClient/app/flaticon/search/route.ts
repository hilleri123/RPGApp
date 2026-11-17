import { NextResponse } from 'next/server';
import { requireUser, searchIcons } from '../flaticonProxy';

export async function GET(request: Request) {
  if (!(await requireUser(request))) {
    return NextResponse.json({ detail: 'Нужно войти' }, { status: 401 });
  }
  const term = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (!term) {
    return NextResponse.json({ detail: 'Введите запрос' }, { status: 400 });
  }
  try {
    const items = await searchIcons(term.slice(0, 80));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ detail: 'Flaticon не ответил на поиск' }, { status: 502 });
  }
}
