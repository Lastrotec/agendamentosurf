-- Dados iniciais reais da escola (idempotente). Sem alunos nem reservas de demonstração.
insert into settings (id) values (1) on conflict (id) do nothing;

insert into places (id, name, short, address, meeting, description, modality, capacity, weekdays, hours, schedule,
                    price_single, price_pack5, price_pack10, lat, lon, facing, wave_factor, exposure_from, exposure_to, sort)
values
  ('jaguaribe', 'Praia de Jaguaribe', 'Jaguaribe', 'Praia de Jaguaribe, Salvador - BA',
   'Orla de Jaguaribe. O ponto exato é confirmado pelo instrutor no WhatsApp.',
   'Aulas individuais de 1 hora, com atenção total do instrutor. Horários das 6h às 12h.',
   'Individual', 1, '{0,1,3,4,5,6}', '{06:00,07:00,08:00,09:00,10:00,11:00}', 'fixed',
   15000, 70000, 140000, -12.958, -38.396, 135, 0.90, 45, 225, 1),
  ('farol', 'Farol da Barra', 'Farol da Barra', 'Farol da Barra, Salvador - BA',
   'Em frente ao Farol da Barra, na faixa de areia. Confirme o ponto com o instrutor.',
   'Aulas para até duas pessoas no mesmo horário. Os horários seguem a maré: pela manhã ou à tarde.',
   'Até 2 pessoas', 2, '{0,1,3,4,5,6}', '{}', 'tide',
   20000, 90000, 180000, -13.011, -38.533, 190, 0.70, 110, 250, 2)
on conflict (id) do nothing;
