import unittest
from vision_observer import classify
class VisionTest(unittest.TestCase):
    def test_pause_overrides_results(self):
        self.assertEqual(classify('Haz clic para seguir jugando Misión completada')[0],'paused')
    def test_menu_is_not_start(self):
        self.assertEqual(classify('Iniciar misión')[0],'menu')
    def test_confirmation_is_not_abandonment(self):
        self.assertEqual(classify('¿Abandonar la misión?')[0],'menu')
    def test_unrecognized_is_unknown(self):
        self.assertEqual(classify('ALT 3000 IAS 100')[0],'unknown')
    def test_actual_h125_pause_menu(self):
        self.assertEqual(classify('Reiniciar Finalizar vuelo Configuración Menú principal')[0],'paused')
    def test_actual_h125_active_hud(self):
        self.assertEqual(classify('Pasos de la misión AIRSPEED ALTITUDE POWER')[0],'pilot_control')
    def test_hud_without_mission_is_unknown(self):
        self.assertEqual(classify('AIRSPEED ALTITUDE POWER')[0],'unknown')
    def test_explicit_cues(self):
        self.assertEqual(classify('Misión completada')[0],'results')
        self.assertEqual(classify('Mission failed')[0],'mission_failed')
        self.assertEqual(classify('Vuela al helipuerto',['Vuela al helipuerto'])[0],'pilot_control')
if __name__=='__main__':unittest.main()
