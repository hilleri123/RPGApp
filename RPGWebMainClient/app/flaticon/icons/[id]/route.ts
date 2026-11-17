import { NextResponse } from 'next/server';
import { downloadPng, rememberAuthor, requireUser } from '../../flaticonProxy';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireUser(request))) {
    return NextResponse.json({ detail: 'Нужно войти' }, { status: 401 });
  }
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ detail: 'Некорректная иконка' }, { status: 400 });
  }
  const author = new URL(request.url).searchParams.get('author_name') ?? '';
  try {
    const png = await downloadPng(id);
    await rememberAuthor(request, id, author);
    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="flaticon-${id}.png"`,
      },
    });
  } catch {
    return NextResponse.json({ detail: 'Не удалось скачать иконку' }, { status: 502 });
  }
}
