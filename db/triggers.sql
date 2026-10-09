CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
CREATE TRIGGER on_auth_user_created_settings AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();
