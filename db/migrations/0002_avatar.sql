-- Ícone de perfil do aluno (silhueta escolhida no app; sem fotos). Nulo = ícone padrão sorteado pelo id.
alter table students add column if not exists avatar text check (avatar is null or avatar ~ '^[a-z-]{2,24}$');
