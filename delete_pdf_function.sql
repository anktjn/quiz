CREATE OR REPLACE FUNCTION delete_pdf_by_id(pdf_id UUID, user_id_param UUID) RETURNS void AS $$ BEGIN DELETE FROM pdfs WHERE id = pdf_id AND user_id = user_id_param; END; $$ LANGUAGE plpgsql;
